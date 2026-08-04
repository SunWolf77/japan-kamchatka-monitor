/**
 * JMA Bosai public quake list → QuakeEvent[].
 * Source: https://www.jma.go.jp/bosai/quake/data/list.json (CORS *).
 * Ported from sun-earth-sentinel/src/lib/feeds/jma.ts for SES node #3.
 */

import type { FetchResult, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";

const JMA_LIST = "https://www.jma.go.jp/bosai/quake/data/list.json";

const PREFERRED = new Set(["VXSE5k", "VXSE52", "VXSE61"]);
const INTENSITY_ONLY = new Set(["VXSE51"]);

export type JmaListItem = {
  ctt?: string;
  eid?: string;
  rdt?: string;
  at?: string;
  ttl?: string;
  en_ttl?: string;
  anm?: string;
  en_anm?: string;
  acd?: string;
  cod?: string;
  mag?: string;
  maxi?: string;
  json?: string;
  ser?: string;
  ift?: string;
};

/** Parse JMA cod "+lat+lon±depth_m/" → lat, lon, depth km. */
export function parseJmaCod(cod: string | null | undefined): {
  lat: number;
  lon: number;
  depthKm: number;
} | null {
  if (!cod) return null;
  const m = String(cod).match(
    /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)\/?/,
  );
  if (!m) return null;
  const lat = parseFloat(m[1]!);
  const lon = parseFloat(m[2]!);
  const depthM = parseFloat(m[3]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const depthKm = Number.isFinite(depthM) ? Math.abs(depthM) / 1000 : 0;
  return { lat, lon, depthKm };
}

export function productCodeFromJson(json: string | undefined): string {
  if (!json) return "";
  const m = json.match(/_(VXSE[^_]+|VYSE[^_]+|VTSE[^_]+)_/i);
  return m?.[1] ?? "";
}

function parseJstToMs(s: string | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Rough shindo → mag proxy so intensity-only events pass minMag filters. */
function shindoToApproxMag(maxi: string): number {
  const t = maxi.trim();
  if (t === "7") return 6.5;
  if (t === "6+" || t === "6強") return 6.0;
  if (t === "6-" || t === "6弱") return 5.7;
  if (t === "5+" || t === "5強") return 5.3;
  if (t === "5-" || t === "5弱") return 5.0;
  if (t === "4") return 4.5;
  if (t === "3") return 4.0;
  if (t === "2") return 3.5;
  return 3.0;
}

function inBbox(
  lat: number,
  lon: number,
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

function mapItem(item: JmaListItem): QuakeEvent | null {
  const product = productCodeFromJson(item.json);
  // Skip pure tsunami products (handled by tsunami feed)
  if (product.startsWith("VTSE") || product.startsWith("VYSE")) return null;

  const coords = parseJmaCod(item.cod);
  if (!coords) return null;
  const { lat, lon, depthKm } = coords;

  const magRaw = item.mag?.trim();
  const mag =
    magRaw && magRaw !== "不明" && magRaw !== "-"
      ? parseFloat(magRaw)
      : NaN;
  const hasMag = Number.isFinite(mag);
  if (!hasMag && INTENSITY_ONLY.has(product)) {
    const maxi = item.maxi || "";
    if (!maxi || maxi === "1" || maxi === "2") return null;
  }
  if (!hasMag && !PREFERRED.has(product) && !item.maxi) return null;

  const eid = (item.eid || item.ctt || "").trim();
  if (!eid) return null;

  const place =
    (item.en_anm || item.anm || "Japan").replace(/\s+/g, " ").trim() || "Japan";
  const time = parseJstToMs(item.at) ?? parseJstToMs(item.rdt);
  if (time == null) return null;
  const maxi = (item.maxi || "").trim();
  const displayMag = hasMag
    ? mag
    : maxi
      ? Math.max(2.5, shindoToApproxMag(maxi))
      : 2.5;

  return {
    id: `jma-${eid}`,
    time,
    latitude: lat,
    longitude: lon,
    depthKm,
    magnitude: hasMag ? mag : displayMag,
    magType: hasMag ? "MJMA" : "shindo",
    place: maxi ? `${place} · shindo ${maxi}` : place,
    eventType: "earthquake",
    author: "JMA",
    provider: "jma",
    catalog: "jma-bosai",
    jmaMaxi: maxi || null,
  };
}

export function parseJmaList(
  items: JmaListItem[],
  opts?: {
    bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
    startMs?: number;
    endMs?: number;
    minMagnitude?: number;
  },
): QuakeEvent[] {
  const rank = (p: string) => {
    if (p === "VXSE5k") return 4;
    if (p === "VXSE52") return 3;
    if (p === "VXSE61") return 2;
    if (p === "VXSE51") return 1;
    return 0;
  };
  const best = new Map<string, JmaListItem>();
  for (const it of items) {
    const eid = (it.eid || "").trim();
    if (!eid) continue;
    const prev = best.get(eid);
    if (!prev) {
      best.set(eid, it);
      continue;
    }
    const rNew = rank(productCodeFromJson(it.json));
    const rOld = rank(productCodeFromJson(prev.json));
    if (rNew > rOld) best.set(eid, it);
    else if (rNew === rOld && (it.ctt || "") > (prev.ctt || "")) best.set(eid, it);
  }

  const events: QuakeEvent[] = [];
  for (const it of best.values()) {
    const e = mapItem(it);
    if (!e) continue;
    if (opts?.bbox && !inBbox(e.latitude, e.longitude, opts.bbox)) continue;
    if (opts?.startMs != null && e.time < opts.startMs) continue;
    if (opts?.endMs != null && e.time > opts.endMs) continue;
    if (
      opts?.minMagnitude != null &&
      Number.isFinite(opts.minMagnitude) &&
      (e.magnitude == null || e.magnitude < opts.minMagnitude)
    ) {
      continue;
    }
    events.push(e);
  }
  events.sort((a, b) => b.time - a.time);
  return events;
}

export const jmaProvider: SeismicProvider = {
  id: "jma",
  label: "JMA Bosai quake list",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const sourceUrl = `${JMA_LIST}?_=${Date.now()}`;
    let res: Response;
    try {
      res = await fetch(sourceUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      throw new Error(
        `JMA network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!res.ok) {
      throw new Error(`JMA Bosai ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as JmaListItem[];
    if (!Array.isArray(data)) {
      throw new Error("JMA list not an array");
    }
    const events = parseJmaList(data, {
      bbox: query.node.bbox,
      startMs: query.start.getTime(),
      endMs: query.end.getTime(),
      minMagnitude: query.minMagnitude,
    });
    return {
      events,
      provider: "jma",
      fetchedAt: Date.now(),
      sourceUrl: JMA_LIST,
      count: events.length,
      window: {
        start: query.start.toISOString(),
        end: query.end.toISOString(),
      },
      nodeId: query.node.id,
      authority: "jma-family",
    };
  },
};
