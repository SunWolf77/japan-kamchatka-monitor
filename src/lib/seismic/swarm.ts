import { energyProxy, magValue } from "../utils";
import type {
  QuakeEvent,
  SwarmAnalysis,
  SwarmCluster,
  SwarmEventChip,
} from "./types";

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function maxMagOf(events: QuakeEvent[]): number {
  const mags = events
    .map((e) => e.magnitude)
    .filter((m): m is number => m != null && Number.isFinite(m));
  return mags.length ? Math.max(...mags) : 0;
}

function bestMagEvent(events: QuakeEvent[]): QuakeEvent {
  return events.reduce((best, e) =>
    magValue(e.magnitude, -99) > magValue(best.magnitude, -99) ? e : best,
  );
}

function toChip(e: QuakeEvent): SwarmEventChip {
  return {
    id: e.id,
    magnitude: e.magnitude,
    depthKm: e.depthKm,
    time: e.time,
    magType: e.magType,
  };
}

export type SwarmOptions = {
  maxGapMs?: number;
  maxRadiusKm?: number;
  minEvents?: number;
  activeWithinMs?: number;
  now?: number;
};

export function detectSwarms(
  events: QuakeEvent[],
  opts: SwarmOptions = {},
): SwarmCluster[] {
  const maxGapMs = opts.maxGapMs ?? 3 * 60 * 60 * 1000;
  const maxRadiusKm = opts.maxRadiusKm ?? 12;
  const minEvents = opts.minEvents ?? 5;
  const activeWithinMs = opts.activeWithinMs ?? 6 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now();

  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.time - b.time);
  const groups: QuakeEvent[][] = [];
  let current: QuakeEvent[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const prev = current[current.length - 1]!;
    const gap = ev.time - prev.time;
    const centroid = {
      lat: mean(current.map((e) => e.latitude)),
      lon: mean(current.map((e) => e.longitude)),
    };
    const dist = haversineKm(centroid, { lat: ev.latitude, lon: ev.longitude });

    if (gap <= maxGapMs && dist <= maxRadiusKm) {
      current.push(ev);
    } else {
      groups.push(current);
      current = [ev];
    }
  }
  groups.push(current);

  const clusters: SwarmCluster[] = [];

  for (const group of groups) {
    if (group.length < minEvents) continue;
    const start = group[0]!.time;
    const end = group[group.length - 1]!.time;
    const durationHours = Math.max((end - start) / 3_600_000, 1 / 60);
    const depths = group.map((e) => e.depthKm);
    const maxMag = maxMagOf(group);
    const maxMagEv = bestMagEvent(group);
    const energy = group.reduce((s, e) => s + energyProxy(e.magnitude), 0);
    const byMag = [...group].sort(
      (a, b) => magValue(b.magnitude) - magValue(a.magnitude),
    );

    clusters.push({
      id: `swarm-${start}-${group.length}`,
      start,
      end,
      // IDs only — full hypocentres live in the top-level catalog
      eventIds: group.map((e) => e.id),
      topEvents: byMag.slice(0, 8).map(toChip),
      count: group.length,
      maxMag,
      maxMagEvent: toChip(maxMagEv),
      meanDepthKm: mean(depths),
      medianDepthKm: median(depths),
      depthRangeKm: [Math.min(...depths), Math.max(...depths)],
      centroid: {
        lat: mean(group.map((e) => e.latitude)),
        lon: mean(group.map((e) => e.longitude)),
      },
      energyProxy: energy,
      ratePerHour: group.length / durationHours,
      durationHours,
      isActive: now - end <= activeWithinMs,
    });
  }

  return clusters.sort((a, b) => b.end - a.end);
}

export function analyzeSwarmActivity(
  events: QuakeEvent[],
  opts: SwarmOptions = {},
): SwarmAnalysis {
  const now = opts.now ?? Date.now();
  const clusters = detectSwarms(events, { ...opts, now });
  const active = clusters.find((c) => c.isActive) ?? null;

  const h1 = now - 3_600_000;
  const h6 = now - 6 * 3_600_000;
  const h24 = now - 24 * 3_600_000;

  const in1 = events.filter((e) => e.time >= h1);
  const in6 = events.filter((e) => e.time >= h6);
  const in24 = events.filter((e) => e.time >= h24);

  const depths = events.map((e) => e.depthKm);
  const shallow = depths.filter((d) => d < 3).length;

  // Cap hourly bins to last 72h — never span YTD (that ballooned SSR)
  const maxBinHours = 72;
  const binMs = 3_600_000;
  const earliest =
    events.length > 0
      ? Math.min(...events.map((e) => e.time))
      : now - maxBinHours * binMs;
  const binStart = Math.max(earliest, now - maxBinHours * binMs);
  const firstBin = Math.floor(binStart / binMs) * binMs;
  const lastBin = Math.floor(now / binMs) * binMs;
  const hourlyBins: SwarmAnalysis["hourlyBins"] = [];

  const counts = new Map<number, { count: number; maxMag: number; depthSum: number }>();
  for (const e of events) {
    if (e.time < firstBin || e.time > now) continue;
    const t = Math.floor(e.time / binMs) * binMs;
    const cur = counts.get(t) ?? { count: 0, maxMag: 0, depthSum: 0 };
    cur.count += 1;
    const m = e.magnitude != null && Number.isFinite(e.magnitude) ? e.magnitude : 0;
    if (m > cur.maxMag) cur.maxMag = m;
    cur.depthSum += e.depthKm;
    counts.set(t, cur);
  }
  for (let t = firstBin; t <= lastBin; t += binMs) {
    const cur = counts.get(t);
    hourlyBins.push({
      t,
      count: cur?.count ?? 0,
      maxMag: cur?.maxMag ?? 0,
      meanDepth: cur && cur.count ? cur.depthSum / cur.count : 0,
    });
  }

  return {
    clusters,
    active,
    rate24h: in24.length,
    rate6h: in6.length,
    rate1h: in1.length,
    maxMagWindow: maxMagOf(events),
    meanDepthKm: mean(depths),
    shallowFraction: depths.length ? shallow / depths.length : 0,
    cumulativeEnergy: events.reduce((s, e) => s + energyProxy(e.magnitude), 0),
    hourlyBins,
  };
}

export function magnitudeHistogram(
  events: QuakeEvent[],
  binSize = 0.5,
): { mag: number; label: string; count: number }[] {
  const mags = events
    .map((e) => e.magnitude)
    .filter((m): m is number => m != null && Number.isFinite(m));
  if (mags.length === 0) return [];
  const min = Math.floor(Math.min(...mags) / binSize) * binSize;
  const max = Math.ceil(Math.max(...mags) / binSize) * binSize;
  const bins: { mag: number; label: string; count: number }[] = [];
  for (let m = min; m < max + binSize / 2; m += binSize) {
    const count = mags.filter((x) => x >= m && x < m + binSize).length;
    bins.push({
      mag: m,
      label: `${m.toFixed(1)}–${(m + binSize).toFixed(1)}`,
      count,
    });
  }
  return bins;
}

export function depthHistogram(
  events: QuakeEvent[],
  binKm = 0.5,
): { depth: number; label: string; count: number; meanMag: number }[] {
  if (events.length === 0) return [];
  const maxD = Math.max(...events.map((e) => e.depthKm), 1);
  const bins: { depth: number; label: string; count: number; meanMag: number }[] = [];
  for (let d = 0; d < maxD + binKm; d += binKm) {
    const group = events.filter((e) => e.depthKm >= d && e.depthKm < d + binKm);
    const mags = group
      .map((e) => e.magnitude)
      .filter((m): m is number => m != null && Number.isFinite(m));
    bins.push({
      depth: d,
      label: `${d.toFixed(1)}–${(d + binKm).toFixed(1)}`,
      count: group.length,
      meanMag: mags.length ? mean(mags) : 0,
    });
  }
  return bins;
}
