import type { FetchResult, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";
import { clampLimit, isoUtc } from "./base";

const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

/**
 * USGS GeoJSON FDSN — authority for Tonga–Kermadec / sun-earth-sentinel global.
 * Schema aligned with SES `EqFeature` (mag may be null; depth from coordinates[2]).
 *
 * Do NOT use as a co-source for Campi Flegrei — authority routing blocks it.
 */
export function parseUsgsGeoJson(data: unknown): QuakeEvent[] {
  if (!data || typeof data !== "object") return [];
  const features = (data as { features?: unknown[] }).features;
  if (!Array.isArray(features)) return [];

  const events: QuakeEvent[] = [];
  for (const f of features) {
    if (!f || typeof f !== "object") continue;
    const feat = f as {
      id?: string;
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: number[] };
    };
    const props = feat.properties ?? {};
    const coords = feat.geometry?.coordinates ?? [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const depthRaw = coords[2];
    const depthKm =
      typeof depthRaw === "number" && Number.isFinite(depthRaw)
        ? Math.abs(depthRaw)
        : 0;
    const time = Number(props.time);

    // Preserve null mag (SES style) — do not coerce to 0
    let magnitude: number | null = null;
    if (props.mag != null && props.mag !== "") {
      const m = Number(props.mag);
      magnitude = Number.isFinite(m) ? m : null;
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(time)) continue;

    const usgsId = feat.id != null ? String(feat.id) : `${time}-${lat}-${lon}`;
    events.push({
      id: usgsId.startsWith("usgs-") ? usgsId : `usgs-${usgsId}`,
      time,
      latitude: lat,
      longitude: lon,
      depthKm,
      magnitude,
      magType: String(props.magType ?? "ml"),
      place: String(props.place ?? "Unknown"),
      eventType: String(props.type ?? "earthquake"),
      author: String(props.net ?? "USGS"),
      provider: "usgs",
      catalog: String(props.net ?? "us"),
    });
  }
  return events;
}

export function buildUsgsUrl(query: SeismicQuery): string {
  const { node, start, end, minMagnitude, limit } = query;
  const params = new URLSearchParams({
    format: "geojson",
    starttime: isoUtc(start),
    endtime: isoUtc(end),
    minlatitude: String(node.bbox.minLat),
    maxlatitude: String(node.bbox.maxLat),
    minlongitude: String(node.bbox.minLon),
    maxlongitude: String(node.bbox.maxLon),
    orderby: "time",
    limit: String(clampLimit(limit, 500, 2000)),
  });
  if (minMagnitude != null && Number.isFinite(minMagnitude)) {
    params.set("minmagnitude", String(minMagnitude));
  }
  return `${USGS_BASE}?${params.toString()}`;
}

export const usgsProvider: SeismicProvider = {
  id: "usgs",
  label: "USGS FDSN Event",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const sourceUrl = buildUsgsUrl(query);
    let res: Response;
    try {
      res = await fetch(sourceUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (err) {
      throw new Error(
        `USGS network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (res.status === 204) {
      return {
        events: [],
        provider: "usgs",
        fetchedAt: Date.now(),
        sourceUrl,
        count: 0,
        window: { start: query.start.toISOString(), end: query.end.toISOString() },
        nodeId: query.node.id,
        authority: "usgs-family",
      };
    }
    if (!res.ok) {
      throw new Error(`USGS FDSN ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    const events = parseUsgsGeoJson(data).sort((a, b) => b.time - a.time);
    return {
      events,
      provider: "usgs",
      fetchedAt: Date.now(),
      sourceUrl,
      count: events.length,
      window: { start: query.start.toISOString(), end: query.end.toISOString() },
      nodeId: query.node.id,
      authority: "usgs-family",
    };
  },
};
