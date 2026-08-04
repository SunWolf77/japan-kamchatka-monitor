/**
 * SUPT Comparative Harmonic layer — adapted from
 * https://github.com/SunWolf77/SUPT-Comparative-Harmonic-System
 *
 * Original pipeline: SAC waveforms → FFT band energy (Tremor 0.5–5 /
 * Mixed 5–15 / Fracture 15–40 Hz) → Pearson r between events + ψ-fold
 * planetary aspects.
 *
 * Browser port (no ObsPy/SAC): build a **catalog energy fingerprint** that
 * maps hypocentre attributes onto the same three-band vocabulary, compare
 * to embedded megaquake templates (Kamchatka M8.8, Nankai Oct 2025 means),
 * and tag simplified Moon–planet angular aspects.
 */

import type { QuakeEvent } from "@/lib/seismic/types";

/** Normalized band energy vector (sums ~100%). */
export type BandVector = {
  tremor: number;
  mixed: number;
  fracture: number;
};

export type HarmonicCorrelation = {
  name: string;
  r: number | null;
  interpretation: string;
};

export type PsiAspect = {
  body: string;
  deg: number;
  psi: number;
  tag: "Strong" | "Quadrature" | "Trine" | "Weak";
};

export type HarmonicReport = {
  source: "SUPT-Comparative-Harmonic-System";
  fingerprint: BandVector;
  /** Self-similarity: first half of window vs second half. */
  selfCorrelation: number | null;
  comparisons: HarmonicCorrelation[];
  aspects: PsiAspect[];
  strongAspectCount: number;
  cascadeHint: string;
  note: string;
};

// ── Reference templates (mean band % from Spectral_Energy_Summary.csv) ──────
// Kamchatsky M8.8 (2025) — mean of published station rows in the repo
export const REF_KAMCHATKA: BandVector = {
  tremor: 58.8,
  mixed: 11.3,
  fracture: 3.4,
};

// Nankai 21 Oct 2025 — approximate mean from repo summary (if sparse, use tremor-heavy)
export const REF_NANKAI: BandVector = {
  tremor: 55.0,
  mixed: 14.0,
  fracture: 4.5,
};

function clip100(v: BandVector): BandVector {
  const s = v.tremor + v.mixed + v.fracture || 1;
  return {
    tremor: (v.tremor / s) * 100,
    mixed: (v.mixed / s) * 100,
    fracture: (v.fracture / s) * 100,
  };
}

/**
 * Map catalog events → Tremor / Mixed / Fracture energy %.
 * Proxy (not true spectral Hz):
 *  - Tremor: shallow (<2.5 km) micro / low-Md
 *  - Fracture: larger Md (≥2.5) or deeper (≥3 km)
 *  - Mixed: remainder
 * Weighted by energy proxy 10^(1.5 M) when mag known, else unit weight.
 */
export function catalogBandFingerprint(events: QuakeEvent[]): BandVector {
  if (!events.length) return { tremor: 0, mixed: 0, fracture: 0 };

  let tremor = 0;
  let mixed = 0;
  let fracture = 0;

  for (const e of events) {
    const m = e.magnitude != null && Number.isFinite(e.magnitude) ? e.magnitude : null;
    const w = m != null ? Math.pow(10, 1.5 * Math.max(0, m - 1)) : 1;
    const shallow = e.depthKm < 2.5;
    const deepish = e.depthKm >= 3;
    const strong = m != null && m >= 2.5;

    if (strong || deepish) fracture += w;
    else if (shallow && (m == null || m < 1.5)) tremor += w;
    else mixed += w;
  }

  return clip100({ tremor, mixed, fracture });
}

export function pearsonR(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  let sa = 0,
    sb = 0,
    saa = 0,
    sbb = 0,
    sab = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i]!;
    sb += b[i]!;
    saa += a[i]! * a[i]!;
    sbb += b[i]! * b[i]!;
    sab += a[i]! * b[i]!;
  }
  const cov = sab - (sa * sb) / n;
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  if (va <= 1e-12 || vb <= 1e-12) return null;
  const r = cov / Math.sqrt(va * vb);
  return Number.isFinite(r) ? r : null;
}

export function vectorCorr(a: BandVector, b: BandVector): number | null {
  return pearsonR(
    [a.tremor, a.mixed, a.fracture],
    [b.tremor, b.mixed, b.fracture],
  );
}

export function interpretR(r: number | null): string {
  if (r == null || !Number.isFinite(r)) return "Insufficient sample";
  const x = Math.abs(r);
  if (x >= 0.95) return "Near-identical band balance (phase-locked proxy)";
  if (x >= 0.7) return "Partial coupling / shared band shape";
  if (x >= 0.4) return "Transitional — mostly local dynamics";
  return "Independent local fingerprint";
}

/** Hourly band series for self-correlation across the window. */
function hourlyBandSeries(
  events: QuakeEvent[],
  now: number,
  hours = 48,
): { tremor: number[]; mixed: number[]; fracture: number[] } {
  const binMs = 3_600_000;
  const start = now - hours * binMs;
  const tremor: number[] = [];
  const mixed: number[] = [];
  const fracture: number[] = [];

  for (let h = 0; h < hours; h++) {
    const t0 = start + h * binMs;
    const t1 = t0 + binMs;
    const bin = events.filter((e) => e.time >= t0 && e.time < t1);
    const fp = catalogBandFingerprint(bin);
    tremor.push(fp.tremor);
    mixed.push(fp.mixed);
    fracture.push(fp.fracture);
  }
  return { tremor, mixed, fracture };
}

function selfHalfCorrelation(events: QuakeEvent[], now: number): number | null {
  if (events.length < 12) return null;
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const mid = Math.floor(sorted.length / 2);
  const a = catalogBandFingerprint(sorted.slice(0, mid));
  const b = catalogBandFingerprint(sorted.slice(mid));
  return vectorCorr(a, b);
}

// ── Simplified planetary aspects (Moon vs body, ecliptic longitude) ─────────
// Mean elements — good enough for Strong/Weak tags, not high-precision ephemeris.

function degNorm(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

function angleSep(a: number, b: number): number {
  let d = Math.abs(degNorm(a) - degNorm(b));
  if (d > 180) d = 360 - d;
  return d;
}

/** Julian centuries from J2000. */
function julianCenturies(ms: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  return (jd - 2451545.0) / 36525;
}

function sunLongitude(T: number): number {
  const L0 = degNorm(280.46646 + 36000.76983 * T);
  const M = degNorm(357.52911 + 35999.05029 * T);
  const Mr = (M * Math.PI) / 180;
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr);
  return degNorm(L0 + C);
}

function moonLongitude(T: number): number {
  const L = degNorm(218.3164477 + 481267.88123421 * T);
  const M = degNorm(134.9633964 + 477198.8675055 * T); // moon anomaly
  const F = degNorm(93.272095 + 483202.0175233 * T);
  const Mr = (M * Math.PI) / 180;
  const Fr = (F * Math.PI) / 180;
  return degNorm(L + 6.289 * Math.sin(Mr) - 1.274 * Math.sin(2 * Fr - Mr));
}

/** Rough mean longitudes for inner/outer planets (low precision). */
function planetLongitude(body: string, T: number): number {
  // Simplified linear elements (deg)
  const el: Record<string, [number, number]> = {
    Mercury: [252.25, 149472.67],
    Venus: [181.98, 58517.82],
    Mars: [355.43, 19140.3],
    Jupiter: [34.35, 3034.91],
    Uranus: [314.05, 428.48],
  };
  const e = el[body];
  if (!e) return 0;
  return degNorm(e[0] + e[1] * T);
}

function tagAspect(diff: number): PsiAspect["tag"] {
  if (diff < 30) return "Strong";
  if (Math.abs(diff - 90) < 5) return "Quadrature";
  if (Math.abs(diff - 120) < 5) return "Trine";
  return "Weak";
}

export function computePsiAspects(now = Date.now()): PsiAspect[] {
  const T = julianCenturies(now);
  const moon = moonLongitude(T);
  const sun = sunLongitude(T);
  const bodies: { name: string; lon: number }[] = [
    { name: "Sun", lon: sun },
    { name: "Mercury", lon: planetLongitude("Mercury", T) },
    { name: "Venus", lon: planetLongitude("Venus", T) },
    { name: "Mars", lon: planetLongitude("Mars", T) },
    { name: "Jupiter", lon: planetLongitude("Jupiter", T) },
    { name: "Uranus", lon: planetLongitude("Uranus", T) },
  ];

  return bodies.map((b) => {
    const deg = angleSep(moon, b.lon);
    return {
      body: b.name,
      deg: Math.round(deg * 10) / 10,
      psi: Math.round(((deg * Math.PI) / 180) * 1000) / 1000,
      tag: tagAspect(deg),
    };
  });
}

export function buildHarmonicReport(
  events: QuakeEvent[],
  now = Date.now(),
): HarmonicReport {
  const fingerprint = catalogBandFingerprint(events);
  const selfCorrelation = selfHalfCorrelation(events, now);

  const comparisons: HarmonicCorrelation[] = [
    {
      name: "Kamchatka M8.8 template",
      r: vectorCorr(fingerprint, REF_KAMCHATKA),
      interpretation: "",
    },
    {
      name: "Nankai Oct-2025 template",
      r: vectorCorr(fingerprint, REF_NANKAI),
      interpretation: "",
    },
  ].map((c) => ({ ...c, interpretation: interpretR(c.r) }));

  const aspects = computePsiAspects(now);
  const strongAspectCount = aspects.filter(
    (a) => a.tag === "Strong" || a.tag === "Quadrature" || a.tag === "Trine",
  ).length;

  const bestR = Math.max(
    ...comparisons.map((c) => (c.r != null ? Math.abs(c.r) : 0)),
    selfCorrelation != null ? Math.abs(selfCorrelation) : 0,
  );

  let cascadeHint =
    "No global cascade flag — local CF fingerprint dominates.";
  if (bestR >= 0.95 && strongAspectCount >= 3) {
    cascadeHint =
      "High band-shape match + ≥3 strong ψ-fold tags — comparative system would flag elevated harmonic context (observational only).";
  } else if (bestR >= 0.7) {
    cascadeHint =
      "Partial template coupling — watch with Continuum EII/CCI, not a prediction.";
  }

  // Use series length so unused helper stays meaningful if we extend UI
  void hourlyBandSeries;

  return {
    source: "SUPT-Comparative-Harmonic-System",
    fingerprint,
    selfCorrelation,
    comparisons,
    aspects,
    strongAspectCount,
    cascadeHint,
    note:
      "Catalog-proxy bands (not SAC FFT). Templates from repo Spectral_Energy_Summary means. ψ-fold angles are low-precision mean-element estimates.",
  };
}
