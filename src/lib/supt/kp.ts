/**
 * NOAA SWPC planetary K-index — shared with sun-earth-sentinel space-weather path.
 * https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
 */

export type KpSample = {
  time: number; // epoch ms
  kp: number;
};

export type KpSnapshot = {
  latest: number;
  samples: KpSample[];
  fetchedAt: number;
  sourceUrl: string;
  error?: string;
};

const KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

/** Parse SWPC planetary K-index JSON (header row + data rows). */
export function parseKpJson(data: unknown): KpSample[] {
  if (!Array.isArray(data) || data.length < 2) return [];
  const out: KpSample[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const tag = String(row[0] ?? "");
    const kp = Number(row[1]);
    // "2026-08-01 00:00:00.000" → treat as UTC
    const iso = tag.includes("T") ? tag : tag.replace(" ", "T");
    const t = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
    if (!Number.isFinite(t) || !Number.isFinite(kp)) continue;
    out.push({ time: t, kp });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** ψₛ solar-pressure proxy from Kp (Continuum v6.6 used a slider 0–1). */
export function psiFromKp(kp: number): number {
  if (!Number.isFinite(kp)) return 0;
  return Math.max(0, Math.min(1, kp / 9));
}

export function emptyKpSnapshot(error?: string): KpSnapshot {
  return {
    latest: 0,
    samples: [],
    fetchedAt: Date.now(),
    sourceUrl: KP_URL,
    error,
  };
}

export { KP_URL };
