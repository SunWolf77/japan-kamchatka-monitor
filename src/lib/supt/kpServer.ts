import { createServerFn } from "@tanstack/react-start";
import {
  KP_URL,
  emptyKpSnapshot,
  parseKpJson,
  type KpSnapshot,
} from "@/lib/supt/kp";
import {
  PLASMA_URL,
  RTSW_URL,
  emptyPlasma,
  parsePlasmaTable,
  parseRtswJson,
  composeSpaceWeather,
  type PlasmaSnapshot,
  type SpaceWeatherSnapshot,
} from "@/lib/supt/spaceWeather";

/** 1-minute Kp product — SolWatch / sunwolf-sentinel-dashboard feed. */
const KP_1M_URL =
  "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

/** @deprecated prefer fetchSpaceWeather */
export const fetchKpSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<KpSnapshot> => {
    const sw = await fetchBoth();
    return sw.kp;
  },
);

/** ReSunance Continuum — NOAA Kp + solar-wind plasma (retry + dual Kp sources). */
export const fetchSpaceWeather = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpaceWeatherSnapshot> => fetchBoth(),
);

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** i));
      }
    }
  }
  throw last;
}

async function fetchBoth(): Promise<SpaceWeatherSnapshot> {
  const [kp, plasma] = await Promise.all([fetchKp(), fetchPlasma()]);
  return composeSpaceWeather(kp, plasma);
}

async function fetchKp(): Promise<KpSnapshot> {
  // Primary: classic planetary K-index table
  try {
    const samples = await withRetry(async () => {
      const res = await fetch(KP_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`NOAA Kp ${res.status}`);
      return parseKpJson(await res.json());
    });
    if (samples.length) {
      return {
        latest: samples[samples.length - 1]!.kp,
        samples: samples.slice(-48),
        fetchedAt: Date.now(),
        sourceUrl: KP_URL,
      };
    }
  } catch {
    // fall through to 1-minute product
  }

  // Fallback: planetary_k_index_1m.json (SolWatch)
  try {
    const res = await fetch(KP_1M_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return emptyKpSnapshot(`NOAA Kp 1m ${res.status}`);
    const data = (await res.json()) as Array<{
      time_tag?: string;
      kp?: number;
      kp_index?: number;
    }>;
    const samples = data
      .map((row) => {
        const tag = String(row.time_tag ?? "");
        const kp = Number(row.kp ?? row.kp_index);
        const iso = tag.includes("T") ? tag : tag.replace(" ", "T");
        const t = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
        if (!Number.isFinite(t) || !Number.isFinite(kp)) return null;
        return { time: t, kp };
      })
      .filter((x): x is { time: number; kp: number } => x != null)
      .slice(-200);
    if (!samples.length) return emptyKpSnapshot("NOAA Kp empty");
    return {
      latest: samples[samples.length - 1]!.kp,
      samples: samples.slice(-48),
      fetchedAt: Date.now(),
      sourceUrl: KP_1M_URL,
    };
  } catch (err) {
    return emptyKpSnapshot(
      err instanceof Error ? err.message : "NOAA Kp fetch failed",
    );
  }
}

async function fetchPlasma(): Promise<PlasmaSnapshot> {
  try {
    const samples = await withRetry(async () => {
      const res = await fetch(PLASMA_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`plasma ${res.status}`);
      return parsePlasmaTable(await res.json());
    });
    if (samples.length) {
      const last = samples[samples.length - 1]!;
      return {
        latestSpeed: last.speed,
        latestDensity: last.density,
        samples: samples.slice(-72),
        fetchedAt: Date.now(),
        sourceUrl: PLASMA_URL,
      };
    }
  } catch {
    // RTSW fallback
  }

  try {
    const res = await fetch(RTSW_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return emptyPlasma(`NOAA RTSW ${res.status}`);
    const samples = parseRtswJson(await res.json());
    if (!samples.length) return emptyPlasma("NOAA plasma empty");
    const last = samples[samples.length - 1]!;
    return {
      latestSpeed: last.speed,
      latestDensity: last.density,
      samples: samples.slice(-120),
      fetchedAt: Date.now(),
      sourceUrl: RTSW_URL,
    };
  } catch (err) {
    return emptyPlasma(
      err instanceof Error ? err.message : "NOAA plasma fetch failed",
    );
  }
}

export type { SpaceWeatherSnapshot };
