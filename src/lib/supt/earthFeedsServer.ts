import { createServerFn } from "@tanstack/react-start";
import {
  SCHUMANN_API_URL,
  TOMSK_BASE,
  emptySchumann,
  parseSchumannJson,
  type SchumannSnapshot,
  type TomskOriginStatus,
} from "@/lib/supt/schumann";
import { fetchTomskChart } from "@/lib/supt/tomskProxy.server";
import {
  GEONET_VAL_URL,
  emptyGeonet,
  parseGeonetVal,
  type GeonetValSnapshot,
} from "@/lib/seismic/geonet";

async function probeTomskOrigin(): Promise<TomskOriginStatus> {
  try {
    const res = await fetch(`${TOMSK_BASE}/sra.jpg`, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "SunEarthSentinel-CF-Monitor/1.0" },
    });
    if (res.ok || res.status === 405 || res.status === 403) return "ok";
  } catch {
    /* try GET */
  }
  try {
    const res = await fetch(`${TOMSK_BASE}/sra.jpg`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
      headers: {
        Range: "bytes=0-64",
        "User-Agent": "SunEarthSentinel-CF-Monitor/1.0",
      },
    });
    return res.ok || res.status === 206 ? "ok" : "down";
  } catch {
    return "down";
  }
}

/** Tomsk-attributed Schumann + composite activity index (ResonanceOne). */
export const fetchSchumann = createServerFn({ method: "GET" }).handler(
  async (): Promise<SchumannSnapshot> => {
    const originP = probeTomskOrigin();
    try {
      const res = await fetch(SCHUMANN_API_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const origin = await originP;
      if (!res.ok) {
        const empty = emptySchumann(`Schumann API ${res.status}`);
        return { ...empty, tomskOrigin: origin };
      }
      return parseSchumannJson(await res.json(), origin);
    } catch (err) {
      const origin = await originP;
      const empty = emptySchumann(
        err instanceof Error ? err.message : "Schumann fetch failed",
      );
      return { ...empty, tomskOrigin: origin };
    }
  },
);

/**
 * Returns a data-URL for a Tomsk chart (client cannot hit .ru DNS).
 * Prefer /api/tomsk middleware when available; this is a fallback.
 */
export const fetchTomskChartDataUrl = createServerFn({ method: "GET" })
  .validator((data: { file?: string }) => data ?? {})
  .handler(async ({ data }): Promise<{ dataUrl: string | null; error?: string }> => {
    const file = data?.file ?? "sra.jpg";
    const result = await fetchTomskChart(file);
    if (!result.ok) {
      return { dataUrl: null, error: result.message };
    }
    const b64 = Buffer.from(result.body).toString("base64");
    return { dataUrl: `data:${result.contentType};base64,${b64}` };
  });

/** GeoNet volcanic alert levels — Kermadec Islands + NZ arc. */
export const fetchGeonetVal = createServerFn({ method: "GET" }).handler(
  async (): Promise<GeonetValSnapshot> => {
    try {
      const res = await fetch(GEONET_VAL_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": "SunEarthSentinel-CF-Monitor/1.0",
        },
        cache: "no-store",
      });
      if (!res.ok) return emptyGeonet(`GeoNet VAL ${res.status}`);
      return parseGeonetVal(await res.json());
    } catch (err) {
      return emptyGeonet(
        err instanceof Error ? err.message : "GeoNet VAL fetch failed",
      );
    }
  },
);
