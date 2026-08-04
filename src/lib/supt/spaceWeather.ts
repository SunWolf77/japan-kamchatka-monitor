/**
 * NOAA SWPC space-weather feeds for Continuum / ReSunance.
 * Ported from SunWolf_ReSunance_Continuum v6.4 + SunWolf-SUPT.
 *
 * Note (2026): classic `products/solar-wind/plasma-7-day.json` is gone (404).
 * Live sources:
 *  - geospace propagated solar wind (speed + density, 1h)
 *  - RTSW 1-minute (fallback)
 */

import {
  KP_URL,
  emptyKpSnapshot,
  parseKpJson,
  psiFromKp,
  type KpSample,
  type KpSnapshot,
} from "@/lib/supt/kp";

/** Preferred live plasma (small, speed+density). */
export const PLASMA_URL =
  "https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json";

/** Fallback real-time solar wind (larger payload). */
export const RTSW_URL =
  "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";

export type PlasmaSample = {
  time: number;
  speed: number; // km/s
  density: number; // p/cm³
  temperature?: number;
};

export type PlasmaSnapshot = {
  latestSpeed: number;
  latestDensity: number;
  samples: PlasmaSample[];
  fetchedAt: number;
  sourceUrl: string;
  error?: string;
};

export type SpaceWeatherSnapshot = {
  kp: KpSnapshot;
  plasma: PlasmaSnapshot;
  /** Combined solar-pressure proxy 0–1 (ReSunance Continuum ψₛ). */
  psiS: number;
  feeds: {
    kp: "ok" | "degraded" | "down";
    plasma: "ok" | "degraded" | "down";
  };
  fetchedAt: number;
};

/** Geospace / legacy array table: [header, ...rows] */
export function parsePlasmaTable(data: unknown): PlasmaSample[] {
  if (!Array.isArray(data) || data.length < 2) return [];
  const header = data[0];
  if (!Array.isArray(header)) return [];
  const cols = header.map((h) => String(h).toLowerCase());
  const iTime = cols.findIndex((c) => c.includes("time_tag") && !c.includes("propagated"));
  const iSpeed = cols.findIndex((c) => c === "speed" || c.includes("speed"));
  const iDens = cols.findIndex((c) => c === "density" || c.includes("dens"));
  const iTemp = cols.findIndex((c) => c.includes("temp"));
  if (iTime < 0 || iSpeed < 0) return [];

  const out: PlasmaSample[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    const tag = String(row[iTime] ?? "");
    const speed = Number(row[iSpeed]);
    const density = iDens >= 0 ? Number(row[iDens]) : 0;
    const temperature = iTemp >= 0 ? Number(row[iTemp]) : undefined;
    const iso = tag.includes("T") ? tag : tag.replace(" ", "T");
    const t = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
    if (!Number.isFinite(t) || !Number.isFinite(speed) || speed <= 0) continue;
    out.push({
      time: t,
      speed,
      density: Number.isFinite(density) ? density : 0,
      temperature: Number.isFinite(temperature) ? temperature : undefined,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** RTSW object array: proton_speed / proton_density */
export function parseRtswJson(data: unknown): PlasmaSample[] {
  if (!Array.isArray(data)) return [];
  const out: PlasmaSample[] = [];
  // Only walk the tail — full file is multi-MB
  const start = Math.max(0, data.length - 500);
  for (let i = start; i < data.length; i++) {
    const row = data[i] as Record<string, unknown> | null;
    if (!row || typeof row !== "object") continue;
    if (row.active === false && out.length > 50) continue;
    const tag = String(row.time_tag ?? "");
    const speed = Number(row.proton_speed);
    const density = Number(row.proton_density);
    const t = Date.parse(tag.endsWith("Z") ? tag : `${tag}Z`);
    if (!Number.isFinite(t) || !Number.isFinite(speed) || speed <= 0) continue;
    out.push({
      time: t,
      speed,
      density: Number.isFinite(density) ? density : 0,
      temperature:
        row.proton_temperature != null && Number.isFinite(Number(row.proton_temperature))
          ? Number(row.proton_temperature)
          : undefined,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

export function emptyPlasma(error?: string): PlasmaSnapshot {
  return {
    latestSpeed: 0,
    latestDensity: 0,
    samples: [],
    fetchedAt: Date.now(),
    sourceUrl: PLASMA_URL,
    error,
  };
}

/**
 * ψₛ from solar wind + Kp.
 * Dynamic-pressure-ish: n·v² normalized, blended with Kp.
 * ~688 km/s + moderate density + quiet Kp ≈ Continuum default 0.72.
 */
export function psiFromSpaceWeather(
  speedKmS: number,
  density: number,
  kp: number,
): number {
  const v = Number.isFinite(speedKmS) ? Math.max(0, speedKmS) : 0;
  const n = Number.isFinite(density) ? Math.max(0, density) : 0;
  const k = Number.isFinite(kp) ? Math.max(0, kp) : 0;

  const pDyn = n * (v / 400) ** 2;
  const pTerm = Math.max(0, Math.min(1, pDyn / 25));
  const vTerm = Math.max(0, Math.min(1, v / 900));
  const nTerm = Math.max(0, Math.min(1, n / 30));
  const kpTerm = psiFromKp(k);

  if (v <= 0 && n <= 0) return kpTerm;

  return Math.max(
    0,
    Math.min(1, 0.4 * pTerm + 0.25 * vTerm + 0.15 * nTerm + 0.2 * kpTerm),
  );
}

export function composeSpaceWeather(
  kp: KpSnapshot,
  plasma: PlasmaSnapshot,
): SpaceWeatherSnapshot {
  const psiS = psiFromSpaceWeather(
    plasma.latestSpeed,
    plasma.latestDensity,
    kp.latest,
  );
  return {
    kp,
    plasma,
    psiS,
    feeds: {
      kp: kp.error ? "down" : kp.samples.length ? "ok" : "degraded",
      plasma: plasma.error
        ? "down"
        : plasma.samples.length
          ? "ok"
          : "degraded",
    },
    fetchedAt: Date.now(),
  };
}

export function emptySpaceWeather(error?: string): SpaceWeatherSnapshot {
  return composeSpaceWeather(emptyKpSnapshot(error), emptyPlasma(error));
}

export type { KpSample, KpSnapshot };
