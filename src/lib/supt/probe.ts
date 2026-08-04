/**
 * Paul Sheppard SUPT frozen probe (α = 0.01).
 *
 * Copyright: Sheppard's Universal Proxy Theory, U.S. Copyright TXu 2-468-771
 * (effective 2025-01-20). That date is the copyright effective date — not a
 * claim about when the operator was frozen.
 *
 * Port notes: even-N median average, Math.floor tail, 1e-12 guards,
 * mulberry32 seed 20250120, Fisher–Yates shuffle. Do not retune α / seed /
 * tail rule / band edges.
 *
 * Ported verbatim from sun-earth-sentinel for Campi Flegrei focus-node parity.
 */

export const SUPT_ALPHA = 0.01;
export const SUPT_SEED = 20250120;

/** U.S. Copyright TXu 2-468-771 effective date (copyright only — not operator freeze). */
export const SUPT_COPYRIGHT = {
  registration: "TXu 2-468-771",
  effectiveDate: "2025-01-20",
  notice:
    "Sheppard's Universal Proxy Theory · U.S. Copyright TXu 2-468-771 (effective 2025-01-20)",
} as const;

/** Corpus anchors — context on the shared axis; never fitted to live windows. */
export const SUPT_ANCHORS = {
  zetaFloor: 3.6125,
  ribosome: 1.88,
  tokamak: 1.93,
  clash: 1.9102,
  clutchCusp: [1.88, 1.96] as const,
};

export type ResonanceBand = "COHERENCE" | "CLUTCH" | "SUB-FLOOR" | "VACUUM" | "N/A";

export type ResonanceScore = {
  d_ij: number | null;
  band: ResonanceBand;
  n: number;
  null_mean: number | null;
  null_sd: number | null;
  z: number | null;
  separated: boolean;
  short_window: boolean;
  note: string;
};

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  // [PORT NOTE] even N must average the two middle values
  if (n % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2;
  return sorted[mid]!;
}

function mad(values: number[], med: number): number {
  const absDev = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return median(absDev);
}

/** Deterministic PRNG for shuffle null (seed 20250120). */
export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * In-place-style Fisher–Yates (Durstenfeld) on a copy.
 * Multiset of gaps is preserved — only order is destroyed (the null hypothesis).
 */
export function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function bandFromD(d: number): ResonanceBand {
  if (!Number.isFinite(d)) return "N/A";
  if (d < 1) return "COHERENCE";
  if (d < 2) return "CLUTCH";
  if (d < SUPT_ANCHORS.zetaFloor) return "SUB-FLOOR";
  return "VACUUM";
}

/**
 * Frozen probe on inter-event gaps (seconds).
 * median/MAD → path → cos → EMA → −log tail → d_ij
 * Returns null when N < 4.
 */
export function probe(values: number[]): number | null {
  const x0 = values.filter((v) => Number.isFinite(v));
  if (x0.length < 4) return null;

  const sorted = x0.slice().sort((a, b) => a - b);
  const med = median(sorted);
  const m = mad(x0, med);
  const x = x0.map((v) => (v - med) / (m + 1e-12));

  const phi: number[] = [];
  let acc = 0;
  for (const v of x) {
    acc += v;
    phi.push(acc);
  }

  const g: number[] = [];
  for (let i = 1; i < phi.length; i++) g.push(phi[i]! - phi[i - 1]!);
  const meanAbs = g.reduce((s, v) => s + Math.abs(v), 0) / (g.length || 1);
  const gn = g.map((v) => v / (meanAbs + 1e-12));

  const C = new Array(gn.length);
  C[0] = Math.cos(2 * Math.PI * gn[0]!);
  for (let i = 1; i < gn.length; i++) {
    C[i] =
      SUPT_ALPHA * Math.cos(2 * Math.PI * gn[i]!) + (1 - SUPT_ALPHA) * C[i - 1]!;
  }

  // tail rule — Math.floor, never Math.round
  const tail = Math.max(50, Math.floor(0.2 * C.length));
  const slice = C.slice(-tail);
  const meanAbsC =
    slice.reduce((s, v) => s + Math.abs(v as number), 0) / (slice.length || 1);
  return -Math.log(meanAbsC + 1e-12);
}

export function resonanceScore(gaps: number[], nShuffle = 80): ResonanceScore {
  const v = gaps.filter((g) => Number.isFinite(g) && g > 0);
  const n = v.length;
  const short_window = n > 0 && n < 50;

  if (n < 4) {
    return {
      d_ij: null,
      band: "N/A",
      n,
      null_mean: null,
      null_sd: null,
      z: null,
      separated: false,
      short_window,
      note: "Need ≥4 gaps.",
    };
  }

  const d = probe(v);
  if (d === null || !Number.isFinite(d)) {
    return {
      d_ij: null,
      band: "N/A",
      n,
      null_mean: null,
      null_sd: null,
      z: null,
      separated: false,
      short_window,
      note: "Probe null.",
    };
  }

  const rng = mulberry32(SUPT_SEED);
  const nulls: number[] = [];
  for (let i = 0; i < nShuffle; i++) {
    const shuffled = fisherYates(v, rng);
    const nd = probe(shuffled);
    if (nd !== null && Number.isFinite(nd)) nulls.push(nd);
  }

  const null_mean = nulls.length ? nulls.reduce((a, b) => a + b, 0) / nulls.length : 0;
  const variance =
    nulls.length > 1
      ? nulls.reduce((s, x) => s + (x - null_mean) ** 2, 0) / (nulls.length - 1)
      : 0;
  const null_sd = Math.sqrt(variance);
  const z = (d - null_mean) / (null_sd + 1e-12);
  const separated = Math.abs(z) >= 3;

  let note = "";
  if (!separated) {
    note = "Not separated from shuffle null — no excess structure detected in this window.";
  } else if (d >= SUPT_ANCHORS.clutchCusp[0] && d <= SUPT_ANCHORS.clutchCusp[1]) {
    note =
      "In CLUTCH cusp band (~1.88–1.96); heavy-tailed noise can land here ~12% of the time.";
  } else if (separated) {
    note = "Separated from shuffle null (|z| ≥ 3) — ordered structure present relative to shuffle baseline.";
  }
  if (short_window) {
    note += " Short window (N < 50) — regime-valid but lower precision.";
  }

  return {
    d_ij: Math.round(d * 1e4) / 1e4,
    band: bandFromD(d),
    n,
    null_mean: Math.round(null_mean * 1e4) / 1e4,
    null_sd: Math.round(null_sd * 1e4) / 1e4,
    z: Math.round(z * 100) / 100,
    separated,
    short_window,
    note: note.trim(),
  };
}

/** Build inter-event times (seconds) from sorted epoch ms. */
export function interEventSeconds(timesMs: number[]): number[] {
  const t = timesMs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < t.length; i++) {
    const dt = (t[i]! - t[i - 1]!) / 1000;
    if (dt > 0) out.push(dt);
  }
  return out;
}

/**
 * Everyday bottom line for the hero card.
 * No CLUTCH / z / d jargon — those live in readingSummaryTech().
 */
export function readingSummary(score: ResonanceScore): string {
  const short = score.short_window
    ? " This window has fewer than 50 gaps, so treat the read as lower precision."
    : "";

  if (score.d_ij === null) {
    return score.n < 4
      ? "Not enough quakes in this window yet — need at least four gaps between events to score spacing."
      : "No score for this window.";
  }

  if (!score.separated) {
    return (
      `The spacing between quakes looks ordinary for this window — like a random mix of the same gaps. ` +
      `That is a real, useful reading (the feed is fine). It does not mean “all clear,” and it is not a forecast.${short}`
    );
  }

  if (
    score.d_ij >= SUPT_ANCHORS.clutchCusp[0] &&
    score.d_ij <= SUPT_ANCHORS.clutchCusp[1]
  ) {
    return (
      `Spacing looks a bit different from pure chance, but still sits in a band that noise can hit fairly often. ` +
      `Worth a glance at the chart — not an alert, not a forecast.${short}`
    );
  }

  if (score.band === "COHERENCE") {
    return (
      `Event spacing is more ordered than a random reordering of the same gaps. ` +
      `This is about timing only — not size, not where, not a prediction of a bigger quake.${short}`
    );
  }
  if (score.band === "CLUTCH") {
    return (
      `Spacing sits in a mixed / transitional pattern — neither strongly ordered nor fully random. ` +
      `Interesting for study; not an operational alert.${short}`
    );
  }
  if (score.band === "SUB-FLOOR") {
    return (
      `Only weak structure shows up versus chance. Timing and magnitude are separate stacks — this does not speak to size.${short}`
    );
  }
  return `Sparse / low-structure spacing on this window’s scale. Still not a forecast.${short}`;
}

/** Operator / SUPT detail line — optional UI disclosure. */
export function readingSummaryTech(score: ResonanceScore): string {
  if (score.d_ij === null) {
    return score.n < 4
      ? "Probe regime incomplete (N gaps < 4)."
      : "No d_ij for this window.";
  }
  const addr = `d=${score.d_ij.toFixed(3)} · ${score.band}`;
  const zbit =
    score.z != null
      ? ` · z=${score.z >= 0 ? "+" : ""}${score.z.toFixed(2)} vs shuffle`
      : "";
  const short = score.short_window ? " · N<50" : "";
  if (!score.separated) {
    return `${addr}${zbit}: not separated from shuffle null (null valid).${short}`;
  }
  if (
    score.d_ij >= SUPT_ANCHORS.clutchCusp[0] &&
    score.d_ij <= SUPT_ANCHORS.clutchCusp[1]
  ) {
    return `${addr}${zbit}: separated but in clutch cusp (~1.88–1.96; noise ~12%).${short}`;
  }
  return `${addr}${zbit}: separated |z|≥3 vs shuffle.${short}`;
}

/** Everyday labels for bands (UI). */
export function bandPlainLabel(band: ResonanceBand): string {
  switch (band) {
    case "COHERENCE":
      return "More ordered than chance";
    case "CLUTCH":
      return "Mixed / transitional";
    case "SUB-FLOOR":
      return "Weak structure";
    case "VACUUM":
      return "Scattered / sparse";
    default:
      return "No reading yet";
  }
}

/** One-line verdict for the hero card. */
export function resonanceVerdict(score: ResonanceScore | null): {
  title: string;
  tone: "null" | "chance" | "ordered" | "mixed" | "sparse" | "none";
} {
  if (!score || score.d_ij == null) {
    return { title: "Waiting for enough events", tone: "none" };
  }
  if (!score.separated) {
    return { title: "Spacing looks ordinary", tone: "chance" };
  }
  if (score.band === "COHERENCE") {
    return { title: "Spacing looks more ordered than chance", tone: "ordered" };
  }
  if (score.band === "CLUTCH") {
    return { title: "Mixed spacing pattern", tone: "mixed" };
  }
  if (score.band === "SUB-FLOOR") {
    return { title: "Only weak structure vs chance", tone: "mixed" };
  }
  return { title: "Sparse / low-structure reading", tone: "sparse" };
}
