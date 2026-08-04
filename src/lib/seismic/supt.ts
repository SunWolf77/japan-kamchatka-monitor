/**
 * Geometric fabric analysis for SES focus-node detective investigations.
 *
 * PCA fracture planes, pairwise lineaments, migration tracks, and a density
 * stress field. This is the *spatial* half of the Campi Flegrei detective —
 * temporal pattern formation uses Paul Sheppard's frozen SUPT probe in
 * `@/lib/supt/probe` (see `runSwarmDetective`).
 *
 * Outputs are geometric / statistical proxies — not official civil-protection
 * products.
 */

import { energyProxy, magValue } from "../utils";
import type { FocusNode, GeoPoint, QuakeEvent, SwarmAnalysis } from "./types";
import { resolveClusterEvents } from "./types";

// ── local ENU (km) ──────────────────────────────────────────────────────────

export type LocalXYZ = { x: number; y: number; z: number; ev: QuakeEvent };

export function toLocal(ev: QuakeEvent, origin: GeoPoint): LocalXYZ {
  const lat0 = (origin.lat * Math.PI) / 180;
  const x = (ev.longitude - origin.lon) * 111.32 * Math.cos(lat0); // E km
  const y = (ev.latitude - origin.lat) * 110.574; // N km
  const z = ev.depthKm; // positive down
  return { x, y, z, ev };
}

export function fromLocal(x: number, y: number, origin: GeoPoint): GeoPoint {
  const lat0 = (origin.lat * Math.PI) / 180;
  return {
    lon: origin.lon + x / (111.32 * Math.cos(lat0)),
    lat: origin.lat + y / 110.574,
  };
}

// ── linear algebra helpers ──────────────────────────────────────────────────

function mean3(pts: LocalXYZ[]): { x: number; y: number; z: number } {
  const n = pts.length || 1;
  let x = 0,
    y = 0,
    z = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

/** Symmetric 3×3 eigen-decomposition via Jacobi (stable for small cov). */
function eigenSymmetric3(m: number[][]): {
  values: [number, number, number];
  vectors: [[number, number, number], [number, number, number], [number, number, number]];
} {
  let a = [
    [m[0]![0]!, m[0]![1]!, m[0]![2]!],
    [m[1]![0]!, m[1]![1]!, m[1]![2]!],
    [m[2]![0]!, m[2]![1]!, m[2]![2]!],
  ];
  let v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let iter = 0; iter < 32; iter++) {
    let p = 0,
      q = 1;
    let max = Math.abs(a[0]![1]!);
    if (Math.abs(a[0]![2]!) > max) {
      max = Math.abs(a[0]![2]!);
      p = 0;
      q = 2;
    }
    if (Math.abs(a[1]![2]!) > max) {
      max = Math.abs(a[1]![2]!);
      p = 1;
      q = 2;
    }
    if (max < 1e-12) break;

    const app = a[p]![p]!;
    const aqq = a[q]![q]!;
    const apq = a[p]![q]!;
    const tau = (aqq - app) / (2 * apq);
    const t =
      Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau)) ||
      (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    const newA = a.map((row) => row.slice());
    newA[p]![p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    newA[q]![q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    newA[p]![q] = newA[q]![p] = 0;
    for (let r = 0; r < 3; r++) {
      if (r === p || r === q) continue;
      const arp = a[r]![p]!;
      const arq = a[r]![q]!;
      newA[r]![p] = newA[p]![r] = c * arp - s * arq;
      newA[r]![q] = newA[q]![r] = s * arp + c * arq;
    }
    a = newA;

    for (let r = 0; r < 3; r++) {
      const vip = v[r]![p]!;
      const viq = v[r]![q]!;
      v[r]![p] = c * vip - s * viq;
      v[r]![q] = s * vip + c * viq;
    }
  }

  const vals: [number, number, number] = [a[0]![0]!, a[1]![1]!, a[2]![2]!];
  const order = [0, 1, 2].sort((i, j) => vals[i]! - vals[j]!);
  const values: [number, number, number] = [
    vals[order[0]!]!,
    vals[order[1]!]!,
    vals[order[2]!]!,
  ];
  const vectors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [v[0]![order[0]!]!, v[1]![order[0]!]!, v[2]![order[0]!]!],
    [v[0]![order[1]!]!, v[1]![order[1]!]!, v[2]![order[1]!]!],
    [v[0]![order[2]!]!, v[1]![order[2]!]!, v[2]![order[2]!]!],
  ];
  return { values, vectors };
}

function covariance3(pts: LocalXYZ[]): number[][] {
  const c = mean3(pts);
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of pts) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dz = p.z - c.z;
    m[0]![0]! += dx * dx;
    m[0]![1]! += dx * dy;
    m[0]![2]! += dx * dz;
    m[1]![0]! += dy * dx;
    m[1]![1]! += dy * dy;
    m[1]![2]! += dy * dz;
    m[2]![0]! += dz * dx;
    m[2]![1]! += dz * dy;
    m[2]![2]! += dz * dz;
  }
  const n = Math.max(pts.length - 1, 1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i]![j]! /= n;
  return m;
}

// ── types ───────────────────────────────────────────────────────────────────

export type FracturePlane = {
  id: string;
  normal: [number, number, number];
  point: { x: number; y: number; z: number };
  strikeDeg: number;
  dipDeg: number;
  rmsKm: number;
  planarity: number;
  support: number;
  trace: [GeoPoint, GeoPoint];
  centroid: GeoPoint;
  meanDepthKm: number;
  label: string;
  confidence: number;
};

export type StressNode = {
  id: string;
  location: GeoPoint;
  depthKm: number;
  score: number;
  energyDensity: number;
  eventCount: number;
  recentCount6h: number;
  meanMag: number;
  maxMag: number;
  localBValue: number | null;
  shallowness: number;
  nearFractureId: string | null;
  nearFractureDistKm: number | null;
  rank: number;
  interpretation: string;
};

export type Lineament = {
  id: string;
  strikeDeg: number;
  weight: number;
  endpoints: [GeoPoint, GeoPoint];
  lengthKm: number;
};

export type MigrationStep = {
  t: number;
  centroid: GeoPoint;
  meanDepthKm: number;
  count: number;
  maxMag: number;
};

export type SuptFinding = {
  id: string;
  severity: "info" | "watch" | "alert";
  title: string;
  detail: string;
  relatedNodeIds?: string[];
  relatedPlaneIds?: string[];
};

export type SuptReport = {
  methodology: "FABRIC";
  methodologyLabel: string;
  generatedAt: number;
  sampleSize: number;
  window: { start: number; end: number };
  unfold: {
    rate1h: number;
    rate6h: number;
    rate24h: number;
    cumulativeEnergy: number;
    meanDepthKm: number;
    shallowFraction: number;
    globalBValue: number | null;
    migration: MigrationStep[];
    migrationSpeedMPerHour: number;
    migrationAzimuthDeg: number | null;
    depthTrendKmPerDay: number;
  };
  patterns: {
    planes: FracturePlane[];
    lineaments: Lineament[];
    cloudAxesKm: [number, number, number];
    elongationAzimuthDeg: number | null;
    planarityIndex: number;
  };
  targets: {
    stressNodes: StressNode[];
    stressField: {
      lat: number;
      lon: number;
      intensity: number;
    }[];
  };
  findings: SuptFinding[];
  detectiveSummary: string;
};

// ── b-value (Aki MLE) ───────────────────────────────────────────────────────

export function estimateBValue(events: QuakeEvent[], mMin = 0.8): number | null {
  const mags = events
    .map((e) => e.magnitude)
    .filter((m): m is number => m != null && Number.isFinite(m) && m >= mMin);
  if (mags.length < 12) return null;
  const meanM = mags.reduce((a, b) => a + b, 0) / mags.length;
  const denom = meanM - (mMin - 0.05);
  if (denom <= 0.05) return null;
  const b = Math.LOG10E / denom;
  if (!Number.isFinite(b) || b <= 0 || b > 3) return null;
  return b;
}

function normalToStrikeDip(nx: number, ny: number, nz: number): {
  strikeDeg: number;
  dipDeg: number;
} {
  let n = [nx, ny, nz];
  const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
  n = n.map((v) => v / len);
  const dip = (Math.acos(Math.min(1, Math.abs(n[2]!))) * 180) / Math.PI;
  let strike = (Math.atan2(n[0]!, n[1]!) * 180) / Math.PI;
  strike = (strike + 90 + 360) % 180;
  return { strikeDeg: strike, dipDeg: dip };
}

function planeRms(
  pts: LocalXYZ[],
  normal: [number, number, number],
  point: { x: number; y: number; z: number },
): number {
  const [nx, ny, nz] = normal;
  let s = 0;
  for (const p of pts) {
    const d = (p.x - point.x) * nx + (p.y - point.y) * ny + (p.z - point.z) * nz;
    s += d * d;
  }
  return Math.sqrt(s / Math.max(pts.length, 1));
}

function kMeans(pts: LocalXYZ[], k: number, iters = 18): LocalXYZ[][] {
  if (pts.length === 0) return [];
  const kk = Math.min(k, pts.length);
  let centroids = Array.from({ length: kk }, (_, i) => {
    const p = pts[Math.floor((i * pts.length) / kk)]!;
    return { x: p.x, y: p.y, z: p.z };
  });

  let clusters: LocalXYZ[][] = Array.from({ length: kk }, () => []);
  for (let iter = 0; iter < iters; iter++) {
    clusters = Array.from({ length: kk }, () => []);
    for (const p of pts) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        const d =
          (p.x - centroids[c]!.x) ** 2 +
          (p.y - centroids[c]!.y) ** 2 +
          (p.z - centroids[c]!.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      clusters[best]!.push(p);
    }
    centroids = clusters.map((cl, i) => {
      if (cl.length === 0) return centroids[i]!;
      return mean3(cl);
    });
  }
  return clusters.filter((c) => c.length >= 8);
}

function fitPlane(
  pts: LocalXYZ[],
  origin: GeoPoint,
  id: string,
): FracturePlane | null {
  if (pts.length < 8) return null;
  const cov = covariance3(pts);
  const { values, vectors } = eigenSymmetric3(cov);
  const normal = vectors[0]! as [number, number, number];
  const nLen = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const n: [number, number, number] = [
    normal[0] / nLen,
    normal[1] / nLen,
    normal[2] / nLen,
  ];
  const point = mean3(pts);
  const rms = planeRms(pts, n, point);
  const planarity2 = values[1]! > 1e-9 ? 1 - values[0]! / values[1]! : 0;
  const planarityScore = Math.max(0, Math.min(1, planarity2));

  const { strikeDeg, dipDeg } = normalToStrikeDip(n[0], n[1], n[2]);

  const extent = Math.sqrt(values[2]!) * 2.5 + 0.4;
  const strikeRad = (strikeDeg * Math.PI) / 180;
  const dx = Math.sin(strikeRad) * extent;
  const dy = Math.cos(strikeRad) * extent;
  const a = fromLocal(point.x - dx, point.y - dy, origin);
  const b = fromLocal(point.x + dx, point.y + dy, origin);
  const centroid = fromLocal(point.x, point.y, origin);

  const confidence = Math.max(
    0,
    Math.min(
      1,
      0.35 * planarityScore +
        0.25 * Math.min(1, pts.length / 40) +
        0.25 * Math.max(0, 1 - rms / 0.8) +
        0.15 * (dipDeg > 20 && dipDeg < 85 ? 1 : 0.4),
    ),
  );

  if (planarityScore < 0.15 && rms > 0.9) return null;

  return {
    id,
    normal: n,
    point,
    strikeDeg,
    dipDeg,
    rmsKm: rms,
    planarity: planarityScore,
    support: pts.length,
    trace: [a, b],
    centroid,
    meanDepthKm: point.z,
    label: `Fracture ${strikeDeg.toFixed(0)}°/${dipDeg.toFixed(0)}°`,
    confidence,
  };
}

function detectLineaments(
  pts: LocalXYZ[],
  origin: GeoPoint,
  maxDistKm = 1.2,
): Lineament[] {
  if (pts.length < 15) return [];
  const bins = new Array(18).fill(0) as number[];
  const pairs: { strike: number; ax: number; ay: number; bx: number; by: number }[] = [];

  const step = pts.length > 200 ? Math.ceil(pts.length / 120) : 1;
  for (let i = 0; i < pts.length; i += step) {
    for (let j = i + 1; j < pts.length; j += step) {
      const a = pts[i]!;
      const b = pts[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.15 || d > maxDistKm) continue;
      let strike = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (strike < 0) strike += 180;
      if (strike >= 180) strike -= 180;
      const bin = Math.min(17, Math.floor(strike / 10));
      bins[bin]! += 1 / d;
      pairs.push({ strike, ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  }

  const peaks: Lineament[] = [];
  const maxBin = Math.max(...bins, 1e-9);
  for (let i = 0; i < bins.length; i++) {
    const w = bins[i]! / maxBin;
    if (w < 0.45) continue;
    const prev = bins[(i + 17) % 18]!;
    const next = bins[(i + 1) % 18]!;
    if (bins[i]! < prev || bins[i]! < next) continue;

    const strikeDeg = i * 10 + 5;
    const near = pairs.filter((p) => {
      let ds = Math.abs(p.strike - strikeDeg);
      if (ds > 90) ds = 180 - ds;
      return ds < 12;
    });
    if (near.length < 8) continue;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of near) {
      minX = Math.min(minX, p.ax, p.bx);
      maxX = Math.max(maxX, p.ax, p.bx);
      minY = Math.min(minY, p.ay, p.by);
      maxY = Math.max(maxY, p.ay, p.by);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const len = Math.hypot(maxX - minX, maxY - minY);
    const rad = (strikeDeg * Math.PI) / 180;
    const half = Math.max(len / 2, 0.5);
    const a = fromLocal(cx - Math.sin(rad) * half, cy - Math.cos(rad) * half, origin);
    const b = fromLocal(cx + Math.sin(rad) * half, cy + Math.cos(rad) * half, origin);
    peaks.push({
      id: `lin-${strikeDeg}`,
      strikeDeg,
      weight: w,
      endpoints: [a, b],
      lengthKm: half * 2,
    });
  }
  return peaks.sort((a, b) => b.weight - a.weight).slice(0, 4);
}

function migrationPath(events: QuakeEvent[], origin: GeoPoint, bins = 8): MigrationStep[] {
  if (events.length < 5) return [];
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const t0 = sorted[0]!.time;
  const t1 = sorted[sorted.length - 1]!.time;
  if (t1 <= t0) return [];
  const steps: MigrationStep[] = [];
  for (let i = 0; i < bins; i++) {
    const a = t0 + ((t1 - t0) * i) / bins;
    const b = t0 + ((t1 - t0) * (i + 1)) / bins;
    const slice = sorted.filter((e) => e.time >= a && e.time <= b);
    if (slice.length === 0) continue;
    const lat = slice.reduce((s, e) => s + e.latitude, 0) / slice.length;
    const lon = slice.reduce((s, e) => s + e.longitude, 0) / slice.length;
    const depth = slice.reduce((s, e) => s + e.depthKm, 0) / slice.length;
    const maxMag = Math.max(...slice.map((e) => magValue(e.magnitude, 0)));
    steps.push({
      t: (a + b) / 2,
      centroid: { lat, lon },
      meanDepthKm: depth,
      count: slice.length,
      maxMag,
    });
  }
  return steps;
}

function buildStressField(
  pts: LocalXYZ[],
  origin: GeoPoint,
  node: FocusNode,
  now: number,
): {
  field: SuptReport["targets"]["stressField"];
  nodes: Omit<
    StressNode,
    "rank" | "nearFractureId" | "nearFractureDistKm" | "interpretation"
  >[];
} {
  const nGrid = 18;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const pad = 0.3;
  const x0 = minX - pad;
  const x1 = maxX + pad;
  const y0 = minY - pad;
  const y1 = maxY + pad;

  const field: SuptReport["targets"]["stressField"] = [];
  const rawNodes: {
    x: number;
    y: number;
    intensity: number;
    depth: number;
    count: number;
    recent: number;
    energy: number;
    mags: number[];
    events: QuakeEvent[];
  }[] = [];

  const sigma = Math.max(0.25, Math.min(0.7, (x1 - x0 + y1 - y0) / 20));
  const t6 = now - 6 * 3_600_000;

  for (let iy = 0; iy < nGrid; iy++) {
    for (let ix = 0; ix < nGrid; ix++) {
      const x = x0 + ((ix + 0.5) / nGrid) * (x1 - x0);
      const y = y0 + ((iy + 0.5) / nGrid) * (y1 - y0);
      let intensity = 0;
      let wSum = 0;
      let depthW = 0;
      let count = 0;
      let recent = 0;
      let energy = 0;
      const mags: number[] = [];
      const localEv: QuakeEvent[] = [];

      for (const p of pts) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        const w = Math.exp(-d2 / (2 * sigma * sigma));
        if (w < 0.05) continue;
        const e = energyProxy(p.ev.magnitude);
        const shallowBoost = 1 + Math.max(0, (3 - p.z) / 3);
        const recentBoost = p.ev.time >= t6 ? 1.6 : 1;
        intensity += w * (0.35 + Math.log10(1 + e)) * shallowBoost * recentBoost;
        wSum += w;
        depthW += w * p.z;
        count++;
        energy += e * w;
        if (p.ev.time >= t6) recent++;
        if (p.ev.magnitude != null) mags.push(p.ev.magnitude);
        localEv.push(p.ev);
      }

      const geo = fromLocal(x, y, origin);
      if (
        geo.lat < node.bbox.minLat - 0.02 ||
        geo.lat > node.bbox.maxLat + 0.02 ||
        geo.lon < node.bbox.minLon - 0.02 ||
        geo.lon > node.bbox.maxLon + 0.02
      ) {
        continue;
      }

      field.push({ lat: geo.lat, lon: geo.lon, intensity });
      if (count >= 3 && intensity > 0) {
        rawNodes.push({
          x,
          y,
          intensity,
          depth: wSum > 0 ? depthW / wSum : 2,
          count,
          recent,
          energy,
          mags,
          events: localEv,
        });
      }
    }
  }

  const sorted = [...rawNodes].sort((a, b) => b.intensity - a.intensity);
  const picked: typeof rawNodes = [];
  for (const cand of sorted) {
    if (picked.length >= 8) break;
    const tooClose = picked.some(
      (p) => Math.hypot(p.x - cand.x, p.y - cand.y) < sigma * 1.6,
    );
    if (tooClose) continue;
    picked.push(cand);
  }

  const maxI = Math.max(...picked.map((p) => p.intensity), 1e-9);
  const nodes = picked.map((p, i) => {
    const geo = fromLocal(p.x, p.y, origin);
    const b = estimateBValue(p.events, 0.6);
    const shallowness = Math.max(0, Math.min(1, 1 - p.depth / 5));
    const bStress = b == null ? 0.5 : Math.max(0, Math.min(1, (1.2 - b) / 0.7));
    const score = Math.round(
      100 *
        Math.min(
          1,
          0.4 * (p.intensity / maxI) +
            0.2 * shallowness +
            0.2 * Math.min(1, p.recent / 8) +
            0.2 * bStress,
        ),
    );
    return {
      id: `stress-${i}`,
      location: geo,
      depthKm: p.depth,
      score,
      energyDensity: p.energy,
      eventCount: p.count,
      recentCount6h: p.recent,
      meanMag: p.mags.length
        ? p.mags.reduce((a, b) => a + b, 0) / p.mags.length
        : 0,
      maxMag: p.mags.length ? Math.max(...p.mags) : 0,
      localBValue: b,
      shallowness,
    };
  });

  const maxF = Math.max(...field.map((f) => f.intensity), 1e-9);
  const normField = field.map((f) => ({
    ...f,
    intensity: f.intensity / maxF,
  }));

  return { field: normField, nodes };
}

/**
 * Spatial fabric analysis: stress nodes + fracture candidates.
 * Prefer `runSwarmDetective` for the full SUPT + fabric investigation.
 */
export function runSuptAnalysis(
  events: QuakeEvent[],
  node: FocusNode,
  swarm?: SwarmAnalysis,
  now = Date.now(),
): SuptReport {
  const sample = events.filter(
    (e) =>
      Number.isFinite(e.latitude) &&
      Number.isFinite(e.longitude) &&
      Math.abs(e.latitude) > 0.1,
  );

  const origin = node.center;
  const pts = sample.map((e) => toLocal(e, origin));

  const activeEvents = resolveClusterEvents(swarm?.active, sample);

  const planeSource =
    activeEvents.length >= 12
      ? activeEvents.map((e) => toLocal(e, origin))
      : pts.length > 80
        ? pts
            .slice()
            .sort((a, b) => b.ev.time - a.ev.time)
            .slice(0, 120)
        : pts;

  const h1 = sample.filter((e) => e.time >= now - 3_600_000).length;
  const h6 = sample.filter((e) => e.time >= now - 6 * 3_600_000).length;
  const h24 = sample.filter((e) => e.time >= now - 24 * 3_600_000).length;
  const depths = sample.map((e) => e.depthKm);
  const meanDepth = depths.length
    ? depths.reduce((a, b) => a + b, 0) / depths.length
    : 0;
  const shallowFraction = depths.length
    ? depths.filter((d) => d < 3).length / depths.length
    : 0;
  const energy = sample.reduce((s, e) => s + energyProxy(e.magnitude), 0);
  const globalB = estimateBValue(sample);
  const migration = migrationPath(sample, origin, 8);

  let migrationSpeed = 0;
  let migrationAz: number | null = null;
  let depthTrend = 0;
  if (migration.length >= 2) {
    const a = migration[0]!;
    const b = migration[migration.length - 1]!;
    const la = toLocal(
      {
        id: "a",
        time: a.t,
        latitude: a.centroid.lat,
        longitude: a.centroid.lon,
        depthKm: a.meanDepthKm,
        magnitude: null,
        magType: "",
        place: "",
        eventType: "",
        author: "",
        provider: "jma",
      },
      origin,
    );
    const lb = toLocal(
      {
        id: "b",
        time: b.t,
        latitude: b.centroid.lat,
        longitude: b.centroid.lon,
        depthKm: b.meanDepthKm,
        magnitude: null,
        magType: "",
        place: "",
        eventType: "",
        author: "",
        provider: "jma",
      },
      origin,
    );
    const distKm = Math.hypot(lb.x - la.x, lb.y - la.y);
    const hours = Math.max((b.t - a.t) / 3_600_000, 0.1);
    migrationSpeed = (distKm * 1000) / hours;
    migrationAz = (Math.atan2(lb.x - la.x, lb.y - la.y) * 180) / Math.PI;
    if (migrationAz < 0) migrationAz += 360;
    depthTrend = ((b.meanDepthKm - a.meanDepthKm) / hours) * 24;
  }

  const planes: FracturePlane[] = [];
  const whole = fitPlane(planeSource, origin, "plane-main");
  if (whole) planes.push(whole);

  const clusters = kMeans(planeSource, 3);
  clusters.forEach((cl, i) => {
    const pl = fitPlane(cl, origin, `plane-c${i}`);
    if (pl && pl.confidence >= 0.35) {
      const dup = planes.some(
        (p) =>
          Math.abs(p.strikeDeg - pl.strikeDeg) < 15 &&
          Math.abs(p.dipDeg - pl.dipDeg) < 15,
      );
      if (!dup) planes.push(pl);
    }
  });
  planes.sort((a, b) => b.confidence - a.confidence);

  const lineaments = detectLineaments(planeSource, origin);

  let cloudAxes: [number, number, number] = [0, 0, 0];
  let elongationAz: number | null = null;
  let planarityIndex = 0;
  if (pts.length >= 5) {
    const cov = covariance3(pts);
    const { values, vectors } = eigenSymmetric3(cov);
    cloudAxes = [
      Math.sqrt(Math.max(values[0]!, 0)),
      Math.sqrt(Math.max(values[1]!, 0)),
      Math.sqrt(Math.max(values[2]!, 0)),
    ];
    planarityIndex =
      values[1]! > 1e-9 ? Math.max(0, Math.min(1, 1 - values[0]! / values[1]!)) : 0;
    const major = vectors[2]!;
    elongationAz = (Math.atan2(major[0]!, major[1]!) * 180) / Math.PI;
    if (elongationAz < 0) elongationAz += 180;
  }

  const { field, nodes: rawNodes } =
    pts.length >= 5
      ? buildStressField(pts, origin, node, now)
      : { field: [], nodes: [] };

  const stressNodes: StressNode[] = rawNodes
    .map((n, i) => {
      let nearId: string | null = null;
      let nearDist: number | null = null;
      const local = toLocal(
        {
          id: n.id,
          time: now,
          latitude: n.location.lat,
          longitude: n.location.lon,
          depthKm: n.depthKm,
          magnitude: null,
          magType: "",
          place: "",
          eventType: "",
          author: "",
          provider: "jma",
        },
        origin,
      );
      for (const pl of planes) {
        const d = Math.abs(
          (local.x - pl.point.x) * pl.normal[0] +
            (local.y - pl.point.y) * pl.normal[1] +
            (local.z - pl.point.z) * pl.normal[2],
        );
        if (nearDist == null || d < nearDist) {
          nearDist = d;
          nearId = pl.id;
        }
      }
      let score = n.score;
      if (nearDist != null && nearDist < 0.35) score = Math.min(100, score + 8);

      const interpretation =
        score >= 75
          ? "High-priority stress node — dense, shallow, energetically active. Preferential site for continued fracture growth."
          : score >= 55
            ? "Moderate stress knot — watch for nesting of aftershocks and rate steps."
            : "Secondary concentration — contextual fabric support.";

      return {
        ...n,
        score,
        rank: i + 1,
        nearFractureId: nearDist != null && nearDist < 0.8 ? nearId : null,
        nearFractureDistKm: nearDist,
        interpretation,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((n, i) => ({ ...n, rank: i + 1, id: `stress-${i}` }));

  const tStart = sample.length ? Math.min(...sample.map((e) => e.time)) : now;
  const tEnd = sample.length ? Math.max(...sample.map((e) => e.time)) : now;

  const topNode = stressNodes[0];
  const topPlane = planes[0];
  const summary = [
    `Fabric scan on ${sample.length} hypocentres.`,
    topNode
      ? `Primary stress @ ${topNode.location.lat.toFixed(3)}°N, ${topNode.location.lon.toFixed(3)}°E (score ${topNode.score}).`
      : "No stress node.",
    topPlane
      ? `Fracture candidate ${topPlane.strikeDeg.toFixed(0)}°/${topPlane.dipDeg.toFixed(0)}°.`
      : "No planar pick.",
  ].join(" ");

  return {
    methodology: "FABRIC",
    methodologyLabel: "Hypocentre fabric (stress + fracture geometry)",
    generatedAt: now,
    sampleSize: sample.length,
    window: { start: tStart, end: tEnd },
    unfold: {
      rate1h: h1,
      rate6h: h6,
      rate24h: h24,
      cumulativeEnergy: energy,
      meanDepthKm: meanDepth,
      shallowFraction,
      globalBValue: globalB,
      migration,
      migrationSpeedMPerHour: migrationSpeed,
      migrationAzimuthDeg: migrationAz,
      depthTrendKmPerDay: depthTrend,
    },
    patterns: {
      planes,
      lineaments,
      cloudAxesKm: cloudAxes,
      elongationAzimuthDeg: elongationAz,
      planarityIndex,
    },
    targets: {
      stressNodes,
      stressField: field,
    },
    findings: [],
    detectiveSummary: summary,
  };
}
