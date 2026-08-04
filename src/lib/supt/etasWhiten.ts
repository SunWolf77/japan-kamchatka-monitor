/**
 * Temporal ETAS-style whitening control (educational / diagnostic).
 *
 * Full MLE ETAS (L-BFGS-B, etc.) is offline research tooling. This lite path uses
 * fixed, literature-typical Omori–Utsu + productivity parameters and a data-driven
 * background μ so the *same* frozen SUPT probe can be re-run on compensator residual gaps.
 *
 * Scope (Paul Sheppard method sheet):
 *  - temporal whitening only — says nothing about spatial clustering
 *  - "structure survives" ≠ forecast
 *  - live product default remains raw-gap probe
 *  - four outcomes: Survives | Vanishes | Both null | Insufficient
 *    (Insufficient = data guard / unreliable control — never promote to Survives)
 *
 * Copyright: Sheppard's Universal Proxy Theory, U.S. Copyright TXu 2-468-771
 * (effective 2025-01-20). That date is the copyright effective date only.
 *
 * λ(t) = μ + Σ_{t_i < t} K e^{α_e (m_i − m_0)} (t − t_i + c)^{−p}
 * residual times τ_k = ∫_0^{t_k} λ(s) ds  → gaps Δτ for the probe
 */

export type EtasEvent = { tMs: number; mag: number };

/** Why the control did not emit Survives / Vanishes / Both-null. */
export type EtasInsufficientReason =
  | "event-count"
  | "residual-short"
  | "numerical"
  | "probe-null"
  | "suspicious-residual"
  | "none";

export type EtasWhitenResult = {
  ok: boolean;
  nEvents: number;
  residualGaps: number[];
  rawGapsSec: number[];
  params: {
    muPerSec: number;
    K: number;
    cSec: number;
    p: number;
    alpha: number;
    m0: number;
  };
  note: string;
  reason: EtasInsufficientReason;
};

/**
 * Fixed Omori–Utsu / productivity control params (not MLE-fitted live).
 * Not L-BFGS-B — no bound-pin from a fit. Reliability is gated by sample size
 * and residual health instead.
 */
export const OMORI_CONTROL = {
  K: 0.28,
  /** Omori c in days */
  cDay: 0.02,
  p: 1.15,
  /** Productivity α_e (log10-mag style scale in this lite form) */
  alphaE: 1.8,
  /** Fraction of catalog rate attributed to background μ */
  muFraction: 0.35,
  /**
   * Minimum events before residual control may emit a positive verdict.
   * Below this → Insufficient (event-count), not Survives.
   */
  minEventsForVerdict: 12,
  /** Minimum residual gaps after transform for a positive verdict */
  minResidualGaps: 8,
} as const;

const K = OMORI_CONTROL.K;
const C_DAY = OMORI_CONTROL.cDay;
const P = OMORI_CONTROL.p;
const ALPHA_E = OMORI_CONTROL.alphaE;

export function interEventGapsSec(timesMs: number[]): number[] {
  const t = timesMs.filter(Number.isFinite).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < t.length; i++) {
    const dt = (t[i]! - t[i - 1]!) / 1000;
    if (dt > 0) out.push(dt);
  }
  return out;
}

function residualHealth(gaps: number[]): { ok: boolean; note: string } {
  if (gaps.length < OMORI_CONTROL.minResidualGaps) {
    return { ok: false, note: "Residual series too short after transform." };
  }
  const finite = gaps.filter((g) => Number.isFinite(g) && g > 0);
  if (finite.length < OMORI_CONTROL.minResidualGaps) {
    return { ok: false, note: "Non-finite or non-positive residual gaps." };
  }
  const mean = finite.reduce((s, g) => s + g, 0) / finite.length;
  if (!(mean > 0) || !Number.isFinite(mean)) {
    return { ok: false, note: "Residual mean collapsed (numerical)." };
  }
  // Coefficient of variation: unit-rate residuals after good whitening are O(1);
  // near-zero CV or extreme range → unreliable transform.
  let varSum = 0;
  for (const g of finite) varSum += (g - mean) ** 2;
  const sd = Math.sqrt(varSum / Math.max(1, finite.length - 1));
  const cv = sd / (mean + 1e-12);
  const max = Math.max(...finite);
  const min = Math.min(...finite);
  if (cv < 0.05) {
    return {
      ok: false,
      note: "Residual gaps nearly constant after transform — unreliable whitening (numerical).",
    };
  }
  if (max / (min + 1e-12) > 1e6) {
    return {
      ok: false,
      note: "Residual dynamic range exploded — unreliable whitening (numerical).",
    };
  }
  return { ok: true, note: "Residual health OK." };
}

/**
 * Build compensator residual gaps for SUPT control.
 * ok=false → Insufficient (never interpret as Survives).
 */
export function etasWhitenResiduals(events: EtasEvent[]): EtasWhitenResult {
  const cleaned = events
    .filter((e) => Number.isFinite(e.tMs) && Number.isFinite(e.mag))
    .sort((a, b) => a.tMs - b.tMs);

  const rawGapsSec = interEventGapsSec(cleaned.map((e) => e.tMs));
  const baseParams = {
    muPerSec: 0,
    K,
    cSec: C_DAY * 86400,
    p: P,
    alpha: ALPHA_E,
    m0: 0,
  };

  if (cleaned.length < OMORI_CONTROL.minEventsForVerdict) {
    return {
      ok: false,
      nEvents: cleaned.length,
      residualGaps: [],
      rawGapsSec,
      params: baseParams,
      reason: "event-count",
      note: `Need ≥ ${OMORI_CONTROL.minEventsForVerdict} events with magnitude for a reliable ETAS residual control (got ${cleaned.length}). Insufficient — not Survives.`,
    };
  }

  const t0 = cleaned[0]!.tMs / 1000;
  const times = cleaned.map((e) => e.tMs / 1000 - t0); // sec from first
  const mags = cleaned.map((e) => e.mag);
  const m0 = Math.min(...mags);
  const T = times[times.length - 1]! || 1;
  if (T < C_DAY * 86400 * 2) {
    return {
      ok: false,
      nEvents: cleaned.length,
      residualGaps: [],
      rawGapsSec,
      params: { ...baseParams, m0 },
      reason: "numerical",
      note: "Catalog span too short relative to Omori c — residual control unreliable. Insufficient.",
    };
  }

  const muPerSec = Math.max(1e-8, (cleaned.length * OMORI_CONTROL.muFraction) / T);
  const cSec = C_DAY * 86400;

  function lambda(t: number, uptoExclusive: number): number {
    let s = muPerSec;
    for (let i = 0; i < uptoExclusive; i++) {
      const ti = times[i]!;
      if (ti >= t) break;
      const dt = t - ti + cSec;
      if (dt <= 0) continue;
      const prod = K * Math.exp(ALPHA_E * (mags[i]! - m0));
      s += prod * Math.pow(dt, -P);
    }
    return s;
  }

  function integrate(a: number, b: number, histEnd: number): number {
    if (b <= a) return 0;
    const span = b - a;
    const steps = Math.min(80, Math.max(8, Math.ceil(span / (cSec * 2))));
    const h = span / steps;
    let acc = 0;
    for (let k = 0; k < steps; k++) {
      const t1 = a + k * h;
      const t2 = t1 + h;
      const l1 = lambda(t1, histEnd);
      const l2 = lambda(t2, histEnd);
      acc += 0.5 * (l1 + l2) * h;
    }
    return acc;
  }

  const tau: number[] = [0];
  let tauAcc = 0;
  for (let k = 1; k < times.length; k++) {
    const step = integrate(times[k - 1]!, times[k]!, k);
    if (!Number.isFinite(step) || step < 0) {
      return {
        ok: false,
        nEvents: cleaned.length,
        residualGaps: [],
        rawGapsSec,
        params: { muPerSec, K, cSec, p: P, alpha: ALPHA_E, m0 },
        reason: "numerical",
        note: "Compensator integral non-finite — residual control unreliable. Insufficient.",
      };
    }
    tauAcc += step;
    tau.push(tauAcc);
  }

  // τ must be strictly non-decreasing
  for (let k = 1; k < tau.length; k++) {
    if (!(tau[k]! >= tau[k - 1]!)) {
      return {
        ok: false,
        nEvents: cleaned.length,
        residualGaps: [],
        rawGapsSec,
        params: { muPerSec, K, cSec, p: P, alpha: ALPHA_E, m0 },
        reason: "numerical",
        note: "Compensator not monotone — residual control unreliable. Insufficient.",
      };
    }
  }

  const residualGaps: number[] = [];
  for (let k = 1; k < tau.length; k++) {
    const d = tau[k]! - tau[k - 1]!;
    if (d > 0 && Number.isFinite(d)) residualGaps.push(d);
  }

  const health = residualHealth(residualGaps);
  if (!health.ok) {
    return {
      ok: false,
      nEvents: cleaned.length,
      residualGaps,
      rawGapsSec,
      params: { muPerSec, K, cSec, p: P, alpha: ALPHA_E, m0 },
      reason:
        residualGaps.length < OMORI_CONTROL.minResidualGaps
          ? "residual-short"
          : "numerical",
      note: `${health.note} Insufficient — not Survives.`,
    };
  }

  return {
    ok: true,
    nEvents: cleaned.length,
    residualGaps,
    rawGapsSec,
    params: { muPerSec, K, cSec, p: P, alpha: ALPHA_E, m0 },
    reason: "none",
    note: "Lite ETAS residual gaps ready — same frozen probe as raw. Fixed Omori params (not MLE / not L-BFGS-B), data-driven μ. Temporal only.",
  };
}

export type EtasControlReading = {
  rawSeparated: boolean | null;
  whiteSeparated: boolean | null;
  rawD: number | null;
  whiteD: number | null;
  verdict: "survives" | "vanishes" | "both-null" | "insufficient";
  reason: EtasInsufficientReason;
  plain: string;
};

/**
 * Four-way control reading. Insufficient is a first-class fourth verdict —
 * never promote unreliable whitening to Survives.
 */
export function interpretEtasControl(
  raw: { d_ij: number | null; separated: boolean },
  white: { d_ij: number | null; separated: boolean },
  opts?: { reason?: EtasInsufficientReason; forceInsufficient?: boolean; note?: string },
): EtasControlReading {
  if (opts?.forceInsufficient) {
    return {
      rawSeparated: raw.d_ij == null ? null : raw.separated,
      whiteSeparated: white.d_ij == null ? null : white.separated,
      rawD: raw.d_ij,
      whiteD: white.d_ij,
      verdict: "insufficient",
      reason: opts.reason ?? "numerical",
      plain:
        opts.note ??
        "Insufficient — residual control not reliable enough for Survives / Vanishes / Both-null.",
    };
  }

  if (raw.d_ij == null || white.d_ij == null) {
    return {
      rawSeparated: raw.d_ij == null ? null : raw.separated,
      whiteSeparated: white.d_ij == null ? null : white.separated,
      rawD: raw.d_ij,
      whiteD: white.d_ij,
      verdict: "insufficient",
      reason: white.d_ij == null ? "probe-null" : "probe-null",
      plain:
        raw.d_ij == null
          ? "Insufficient — raw probe null (need more events)."
          : "Insufficient — whitened probe null after residual transform.",
    };
  }

  const rs = raw.separated;
  const ws = white.separated;

  // Structure only after whitening is not a trusted positive — treat as unreliable control
  if (!rs && ws) {
    return {
      rawSeparated: rs,
      whiteSeparated: ws,
      rawD: raw.d_ij,
      whiteD: white.d_ij,
      verdict: "insufficient",
      reason: "suspicious-residual",
      plain:
        "Insufficient — structure appears only after whitening (suspicious residual). Not reported as Survives.",
    };
  }

  if (rs && ws) {
    return {
      rawSeparated: rs,
      whiteSeparated: ws,
      rawD: raw.d_ij,
      whiteD: white.d_ij,
      verdict: "survives",
      reason: "none",
      plain:
        "Structure survives whitening — not fully explained by background + Omori-style triggering (temporal only).",
    };
  }
  if (rs && !ws) {
    return {
      rawSeparated: rs,
      whiteSeparated: ws,
      rawD: raw.d_ij,
      whiteD: white.d_ij,
      verdict: "vanishes",
      reason: "none",
      plain:
        "Structure vanishes after whitening — raw d_ij was largely reading clustering ETAS already describes. Still a useful fast proxy.",
    };
  }
  return {
    rawSeparated: rs,
    whiteSeparated: ws,
    rawD: raw.d_ij,
    whiteD: white.d_ij,
    verdict: "both-null",
    reason: "none",
    plain:
      "Both null — no timing structure either way vs shuffle. First-class result, not a failure.",
  };
}
