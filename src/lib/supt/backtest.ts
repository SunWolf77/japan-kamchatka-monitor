/**
 * Lightweight SUPT probe backtests — synthetic + optional live-shaped sequences.
 * Validates frozen operator behavior without network in pure unit cases.
 */

import { probe, resonanceScore, interEventSeconds, SUPT_ANCHORS } from "@/lib/supt/probe";

export type BacktestCase = {
  id: string;
  name: string;
  /** What we expect qualitatively */
  expect: "coherence-ish" | "null-or-high-d" | "any" | "short-null";
  values: number[];
};

export type BacktestResult = {
  id: string;
  name: string;
  expect: BacktestCase["expect"];
  d_ij: number | null;
  band: string;
  z: number | null;
  separated: boolean;
  n: number;
  pass: boolean;
  note: string;
};

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nearly periodic gaps → should tend toward lower d / more structure than pure noise. */
function periodicGaps(n: number, base = 3600, jitter = 0.02, seed = 1): number[] {
  const rng = mulberry(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base * (1 + (rng() - 0.5) * 2 * jitter));
  }
  return out;
}

/** Heavy-tailed random gaps (lognormal-ish). */
function noiseGaps(n: number, seed = 2): number[] {
  const rng = mulberry(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller-ish
    const u = Math.max(1e-9, rng());
    const v = Math.max(1e-9, rng());
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    out.push(Math.exp(7 + z * 0.8)); // seconds-ish
  }
  return out;
}

export function defaultBacktestCases(): BacktestCase[] {
  return [
    {
      id: "too-short",
      name: "n < 4 → null",
      expect: "short-null",
      values: [1, 2, 3],
    },
    {
      id: "periodic-80",
      name: "Near-periodic gaps (n=80)",
      expect: "coherence-ish",
      values: periodicGaps(80, 3600, 0.01, 11),
    },
    {
      id: "noise-80",
      name: "Heavy-tailed noise (n=80)",
      expect: "null-or-high-d",
      values: noiseGaps(80, 22),
    },
    {
      id: "periodic-20-short",
      name: "Periodic short window (n=20)",
      expect: "any",
      values: periodicGaps(20, 1800, 0.02, 33),
    },
    {
      id: "shuffle-invariant-mass",
      name: "Same multiset as periodic (shuffled once)",
      expect: "null-or-high-d",
      values: (() => {
        const p = periodicGaps(80, 3600, 0.01, 11);
        const rng = mulberry(99);
        const a = p.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [a[i], a[j]] = [a[j]!, a[i]!];
        }
        return a;
      })(),
    },
    {
      id: "event-times-derived",
      name: "From event epochs via interEventSeconds",
      expect: "coherence-ish",
      values: (() => {
        const gaps = periodicGaps(60, 7200, 0.015, 44);
        let t = 1_700_000_000_000;
        const times = [t];
        for (const g of gaps) {
          t += g * 1000;
          times.push(t);
        }
        return interEventSeconds(times);
      })(),
    },
  ];
}

export function runBacktestCase(c: BacktestCase, shuffleN = 40): BacktestResult {
  const score = resonanceScore(c.values, shuffleN);
  const d = score.d_ij;
  let pass = true;
  let note = score.note || "";

  if (c.expect === "short-null") {
    pass = d === null;
    note = pass ? "Correct null for short series" : "Expected null for n<4";
  } else if (c.expect === "coherence-ish") {
    // Soft: d below vacuum floor OR separated with d < clutch upper
    pass =
      d != null &&
      (d < SUPT_ANCHORS.zetaFloor || (score.separated && d < 2.5) || d < 2);
    if (!pass && d != null) {
      // still pass if clearly lower than its own shuffle mean by z<-1.5
      pass = score.z != null && score.z < -1.5;
    }
    note = pass
      ? `Structure-friendly: d=${d?.toFixed(3)} z=${score.z}`
      : `Expected more structure: d=${d} z=${score.z}`;
  } else if (c.expect === "null-or-high-d") {
    pass =
      d == null ||
      !score.separated ||
      d >= 1.5 ||
      (score.z != null && Math.abs(score.z) < 3);
    note = pass
      ? `Noise-like or non-sep: d=${d?.toFixed(3)} sep=${score.separated}`
      : `Unexpected strong sep: d=${d} z=${score.z}`;
  } else {
    pass = true;
    note = `d=${d?.toFixed(3) ?? "null"} band=${score.band}`;
  }

  // Sanity: probe finite when n>=4
  if (c.values.filter(Number.isFinite).length >= 4) {
    const raw = probe(c.values);
    if (raw == null || !Number.isFinite(raw)) {
      pass = false;
      note = "probe returned non-finite for n>=4";
    }
  }

  return {
    id: c.id,
    name: c.name,
    expect: c.expect,
    d_ij: d,
    band: score.band,
    z: score.z,
    separated: score.separated,
    n: score.n,
    pass,
    note,
  };
}

export function runFullBacktest(shuffleN = 40): {
  results: BacktestResult[];
  passed: number;
  total: number;
  ok: boolean;
  summary: string;
} {
  const results = defaultBacktestCases().map((c) => runBacktestCase(c, shuffleN));
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  const ok = passed === total;
  return {
    results,
    passed,
    total,
    ok,
    summary: ok
      ? `All ${total} backtests passed`
      : `${passed}/${total} passed — review failures`,
  };
}
