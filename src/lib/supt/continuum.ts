/**
 * SunWolf ReSunance Continuum metrics
 * -----------------------------------
 * Ports:
 *  - SunWolf-SUPT v6.6 (EII / RPAM / CCI / diagnostic)
 *  - SunWolf_ReSunance_Continuum v6.4 (live solar-wind ψₛ, feed status)
 *  - SUPT-Dashboard: Schumann factor multiplies external ELF coupling into EII
 *
 * Live GOSSIP/INGV catalog + NOAA Kp + solar-wind plasma + Tomsk Schumann.
 * Softened public language (no "collapse window" claim).
 * Not a civil-protection product.
 */

import type { QuakeEvent } from "@/lib/seismic/types";
import type { KpSnapshot } from "@/lib/supt/kp";
import { psiFromKp } from "@/lib/supt/kp";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import type { SchumannSnapshot } from "@/lib/supt/schumann";

export type RpamPhase = "MONITORING" | "ELEVATED" | "ACTIVE";

export type ContinuumReport = {
  source: "ReSunance Continuum v6.5 / SunWolf-SUPT v6.6 + Schumann";
  eii: number;
  /** Pre-Schumann base coupling (for transparency) */
  eiiBase: number;
  rpam: RpamPhase;
  rpamLabel: string;
  cci: number;
  cciLabel: "Decoupled" | "Moderate" | "Coherent";
  psiS: number;
  /** How ψₛ was derived */
  psiSource: "solar-wind+kp" | "kp-only" | "fallback";
  kp: number;
  solarSpeed: number;
  solarDensity: number;
  geomagLabel: string;
  /** Tomsk / ResonanceOne Schumann */
  schumannIndex: number;
  schumannFactor: number;
  schumannLabel: string;
  mdMax: number;
  mdMean: number;
  shallowRatio: number;
  nWithMag: number;
  nEvents: number;
  diagnostic: string;
  feeds: {
    kp: "ok" | "degraded" | "down";
    plasma: "ok" | "degraded" | "down";
    seismic: "ok" | "degraded" | "down";
    schumann: "ok" | "degraded" | "down";
  };
  terms: {
    mdMaxTerm: number;
    mdMeanTerm: number;
    shallowTerm: number;
    psiTerm: number;
    schumannTerm: number;
  };
};

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * EII with Schumann ELF amplifier.
 *
 * Seismic + geomagnetic base (weights sum 0.88):
 *   Md max 0.18 · Md mean 0.12 · shallow 0.35 · ψₛ 0.23
 * Schumann term (0.12): maps factor ∈ [0.5, 2] → [0, 1] then × 0.12
 *
 * Also applies SUPT-Dashboard-style multiplicative ELF boost:
 *   eii = clip(base + schumannTerm) then mild scale by factor.
 */
export function computeEii(
  mdMax: number,
  mdMean: number,
  shallowRatio: number,
  psiS: number,
  schumannFactor = 1,
): { eii: number; eiiBase: number; terms: ContinuumReport["terms"] } {
  const mdMaxTerm = mdMax * 0.18;
  const mdMeanTerm = mdMean * 0.12;
  const shallowTerm = shallowRatio * 0.35;
  const psiTerm = psiS * 0.23;
  // factor 0.5 → 0, 1.0 → ~0.33, 2.0 → 1.0 on the unit scale for the term
  const schumannNorm = clip01((schumannFactor - 0.5) / 1.5);
  const schumannTerm = schumannNorm * 0.12;

  const eiiBase = clip01(mdMaxTerm + mdMeanTerm + shallowTerm + psiTerm);
  // Multiplicative ELF amplifier (dashboard): ~±12% around baseline factor 1
  const elfScale = 0.88 + 0.12 * schumannFactor; // factor 1 → 1.0, factor 2 → 1.12
  const eii = clip01((eiiBase + schumannTerm) * (elfScale / (0.88 + 0.12)));

  return {
    eii,
    eiiBase,
    terms: { mdMaxTerm, mdMeanTerm, shallowTerm, psiTerm, schumannTerm },
  };
}

export function classifyRpam(eii: number): { phase: RpamPhase; label: string } {
  if (eii >= 0.85) {
    return {
      phase: "ACTIVE",
      label: "ACTIVE — high energetic coupling (unrest pulse)",
    };
  }
  if (eii >= 0.6) {
    return {
      phase: "ELEVATED",
      label: "ELEVATED — pressure coupling phase",
    };
  }
  return {
    phase: "MONITORING",
    label: "MONITORING — baseline / low coupling",
  };
}

export function classifyCci(cci: number): ContinuumReport["cciLabel"] {
  if (cci >= 0.7) return "Coherent";
  if (cci >= 0.4) return "Moderate";
  return "Decoupled";
}

export function geomagFromKp(kp: number): string {
  if (kp >= 5) return "Geomagnetic storm range — possible resonance amplifier";
  if (kp >= 3) return "Moderate geomagnetic activity — mild external forcing";
  return "Quiet geomagnetic conditions";
}

function pearsonR(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 4) return null;
  let sa = 0,
    sb = 0,
    saa = 0,
    sbb = 0,
    sab = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    sa += x;
    sb += y;
    saa += x * x;
    sbb += y * y;
    sab += x * y;
  }
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2;
  const vb = sbb / n - (sb / n) ** 2;
  if (va <= 1e-12 || vb <= 1e-12) return null;
  return cov / Math.sqrt(va * vb);
}

export function computeCci(
  events: QuakeEvent[],
  sw: SpaceWeatherSnapshot | null,
  now = Date.now(),
): number {
  if (events.length < 8) return 0.2;
  const windowMs = 72 * 3_600_000;
  const recent = events.filter((e) => e.time >= now - windowMs);
  if (recent.length < 6) return 0.25;

  const binMs = 3 * 3_600_000;
  const bins: { depth: number; n: number }[] = [];
  for (let t = now - windowMs; t < now; t += binMs) {
    const chunk = recent.filter((e) => e.time >= t && e.time < t + binMs);
    if (!chunk.length) {
      bins.push({ depth: 0, n: 0 });
      continue;
    }
    bins.push({
      depth: chunk.reduce((s, e) => s + e.depthKm, 0) / chunk.length,
      n: chunk.length,
    });
  }

  const depthSeries = bins.map((b) => (b.n ? b.depth : 0));
  // Proxy external driver: use Kp samples if present, else rate series
  let driver: number[];
  if (sw?.kp.samples?.length) {
    driver = bins.map((b, i) => {
      const tMid = now - windowMs + i * binMs + binMs / 2;
      const samp = sw.kp.samples.reduce((best, s) =>
        Math.abs(s.time - tMid) < Math.abs(best.time - tMid) ? s : best,
      );
      return samp.kp;
    });
  } else {
    driver = bins.map((b) => b.n);
  }

  const r = pearsonR(depthSeries, driver);
  if (r == null) return 0.3;
  // High |r| → coherent coupling; invert depth correlation sign-agnostic
  return clip01(0.35 + Math.abs(r) * 0.65);
}

export function buildContinuumReport(
  events: QuakeEvent[],
  swOrKp: SpaceWeatherSnapshot | KpSnapshot | null | undefined,
  now = Date.now(),
  schumann?: SchumannSnapshot | null,
): ContinuumReport {
  let sw: SpaceWeatherSnapshot | null = null;
  let kpOnly: KpSnapshot | null = null;
  if (swOrKp && "plasma" in swOrKp && "psiS" in swOrKp) {
    sw = swOrKp as SpaceWeatherSnapshot;
  } else if (swOrKp && "latest" in swOrKp && "samples" in swOrKp) {
    kpOnly = swOrKp as KpSnapshot;
  }

  const mags = events
    .map((e) => e.magnitude)
    .filter((m): m is number => m != null && Number.isFinite(m));
  const mdMax = mags.length ? Math.max(...mags) : 0;
  const mdMean = mags.length ? mags.reduce((a, b) => a + b, 0) / mags.length : 0;
  const shallowRatio = events.length
    ? events.filter((e) => e.depthKm < 2.5).length / events.length
    : 0;

  let psiS: number;
  let psiSource: ContinuumReport["psiSource"];
  let solarSpeed = 0;
  let solarDensity = 0;
  let kpLatest = 0;
  let feeds: ContinuumReport["feeds"];

  const schumannFactor = schumann?.schumannFactor ?? 1;
  const schumannIndex = schumann?.schumannIndex ?? 0;
  const schumannLabel = schumann
    ? `SR ${schumannIndex} · factor ${schumannFactor.toFixed(2)} · ${schumann.activityLabel}`
    : "Schumann feed offline — factor 1.0 (neutral)";

  if (sw) {
    psiS = sw.psiS;
    psiSource =
      sw.feeds.plasma === "ok" || sw.plasma.latestSpeed > 0
        ? "solar-wind+kp"
        : sw.feeds.kp === "ok"
          ? "kp-only"
          : "fallback";
    solarSpeed = sw.plasma.latestSpeed;
    solarDensity = sw.plasma.latestDensity;
    kpLatest = sw.kp.latest;
    feeds = {
      kp: sw.feeds.kp,
      plasma: sw.feeds.plasma,
      seismic: events.length >= 5 ? "ok" : events.length > 0 ? "degraded" : "down",
      schumann: schumann?.error
        ? "down"
        : schumann && schumann.schumannIndex > 0
          ? "ok"
          : "degraded",
    };
  } else {
    kpLatest = kpOnly?.latest ?? 0;
    psiS = psiFromKp(kpLatest);
    psiSource = kpOnly?.samples.length ? "kp-only" : "fallback";
    feeds = {
      kp: kpOnly?.error ? "down" : kpOnly?.samples.length ? "ok" : "degraded",
      plasma: "down",
      seismic: events.length >= 5 ? "ok" : events.length > 0 ? "degraded" : "down",
      schumann: schumann?.error
        ? "down"
        : schumann && schumann.schumannIndex > 0
          ? "ok"
          : "degraded",
    };
  }

  const { eii, eiiBase, terms } = computeEii(
    mdMax,
    mdMean,
    shallowRatio,
    psiS,
    schumannFactor,
  );
  const { phase, label } = classifyRpam(eii);
  const cci = computeCci(events, sw, now);
  const cciLabel = classifyCci(cci);
  const geomagLabel = geomagFromKp(kpLatest);

  const phaseMsg =
    phase === "ACTIVE"
      ? "System energetically loaded — high shallow-swarm contribution and/or external ψₛ/Schumann forcing. Investigate stress nodes + SUPT rhythm; not a collapse prediction."
      : phase === "ELEVATED"
        ? "Harmonic tension buildup. Energy transfer active; watch coherence, swarm rate, and Schumann ELF."
        : "System near baseline; no strong external coupling signature.";

  const cohMsg =
    cciLabel === "Coherent"
      ? "ψₛ–depth phases aligned (CCI high); resonance feedback possible."
      : cciLabel === "Moderate"
        ? "Partial ψₛ–depth coherence; energy exchange weak/intermittent."
        : "ψₛ–depth phases misaligned or under-sampled; local dynamics dominate.";

  const windNote =
    solarSpeed > 0
      ? `Solar wind ${solarSpeed.toFixed(0)} km/s · n=${solarDensity.toFixed(1)} cm⁻³ · ψₛ=${psiS.toFixed(2)} (${psiSource}).`
      : `ψₛ=${psiS.toFixed(2)} (${psiSource}).`;

  const srNote =
    schumann && !schumann.error
      ? `Schumann SR=${schumannIndex} (factor ${schumannFactor.toFixed(2)}) · ELF term ${terms.schumannTerm.toFixed(3)} · ΔEII ${(eii - eiiBase).toFixed(3)}.`
      : "Schumann neutral (no live factor).";

  const diagnostic = [
    `RPAM: ${label}`,
    `EII=${eii.toFixed(3)} (base ${eiiBase.toFixed(3)}) · CCI=${cci.toFixed(3)} (${cciLabel}) · Kp=${kpLatest.toFixed(1)}`,
    windNote,
    srNote,
    geomagLabel + ".",
    phaseMsg,
    cohMsg,
  ].join(" ");

  return {
    source: "ReSunance Continuum v6.5 / SunWolf-SUPT v6.6 + Schumann",
    eii,
    eiiBase,
    rpam: phase,
    rpamLabel: label,
    cci,
    cciLabel,
    psiS,
    psiSource,
    kp: kpLatest,
    solarSpeed,
    solarDensity,
    geomagLabel,
    schumannIndex,
    schumannFactor,
    schumannLabel,
    mdMax,
    mdMean,
    shallowRatio,
    nWithMag: mags.length,
    nEvents: events.length,
    diagnostic,
    feeds,
    terms,
  };
}
