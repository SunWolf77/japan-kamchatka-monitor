import type { FetchResult, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";
import { clampLimit, isoUtc } from "./base";

const INGV_BASE = "https://webservices.ingv.it/fdsnws/event/1/query";

function parseOptionalNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "--" || s.toUpperCase() === "N/D" || s.toUpperCase() === "NULL") {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse INGV FDSN text catalog (pipe-delimited).
 * Header:
 * #EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType
 *
 * Incomplete rows (missing lat/lon/time) are skipped — same class of failure that
 * previously crashed CF monitors when depth/mag fields were empty/N/D.
 */
export function parseIngvText(text: string): QuakeEvent[] {
  if (!text || typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const events: QuakeEvent[] = [];

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const cols = line.split("|");
    // Need at least id, time, lat, lon, depth
    if (cols.length < 5) continue;

    const eventId = cols[0]?.trim();
    const timeStr = cols[1]?.trim();
    const lat = parseOptionalNumber(cols[2]);
    const lon = parseOptionalNumber(cols[3]);
    const depthKm = parseOptionalNumber(cols[4]) ?? 0;
    const author = cols[5]?.trim() || "INGV";
    const catalog = cols[6]?.trim() || undefined;
    const contributor = cols[7]?.trim() || undefined;
    const magType = cols[9]?.trim() || "Md";
    const magnitude = parseOptionalNumber(cols[10]);
    const place = cols[12]?.trim() || "Campi Flegrei";
    const eventType = cols[13]?.trim() || "earthquake";

    if (!eventId || lat == null || lon == null) continue;
    // Guard against empty coordinate columns that parse as 0,0
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) continue;

    const iso = timeStr?.endsWith("Z") ? timeStr : `${timeStr ?? ""}Z`;
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) continue;

    events.push({
      id: `ingv-${eventId}`,
      time,
      latitude: lat,
      longitude: lon,
      depthKm: Number.isFinite(depthKm) && depthKm >= 0 ? depthKm : 0,
      magnitude, // null when N/D / empty — do not coerce to 0
      magType: magnitude == null ? "N/D" : magType,
      place,
      eventType,
      author,
      provider: "ingv",
      catalog,
      contributor,
    });
  }

  return events;
}

export function buildIngvUrl(query: SeismicQuery): string {
  const { node, start, end, minMagnitude, limit } = query;
  const params = new URLSearchParams({
    starttime: isoUtc(start),
    endtime: isoUtc(end),
    minlat: String(node.bbox.minLat),
    maxlat: String(node.bbox.maxLat),
    minlon: String(node.bbox.minLon),
    maxlon: String(node.bbox.maxLon),
    format: "text",
    orderby: "time",
    limit: String(clampLimit(limit, 800, 2000)),
  });
  if (minMagnitude != null && Number.isFinite(minMagnitude)) {
    params.set("minmag", String(minMagnitude));
  }
  // Prefer shallow CF hypocentres when the node is Campi Flegrei
  if ((node.id as string) === "campi-flegrei") {
    params.set("maxdepth", "10");
  }
  return `${INGV_BASE}?${params.toString()}`;
}

export const ingvProvider: SeismicProvider = {
  id: "ingv",
  label: "INGV FDSN Event",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const sourceUrl = buildIngvUrl(query);
    let res: Response;
    try {
      res = await fetch(sourceUrl, {
        headers: { Accept: "text/plain" },
        cache: "no-store",
      });
    } catch (err) {
      throw new Error(
        `INGV FDSN network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 204 No Content = empty catalog (valid)
    if (res.status === 204) {
      return {
        events: [],
        provider: "ingv",
        fetchedAt: Date.now(),
        sourceUrl,
        count: 0,
        window: { start: query.start.toISOString(), end: query.end.toISOString() },
        nodeId: query.node.id,
      };
    }

    if (!res.ok) {
      throw new Error(`INGV FDSN ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    // HTML error page instead of text catalog
    if (text.trimStart().startsWith("<!") || text.trimStart().startsWith("<html")) {
      throw new Error("INGV FDSN returned HTML instead of text catalog");
    }

    const events = parseIngvText(text).sort((a, b) => b.time - a.time);

    return {
      events,
      provider: "ingv",
      fetchedAt: Date.now(),
      sourceUrl,
      count: events.length,
      window: { start: query.start.toISOString(), end: query.end.toISOString() },
      nodeId: query.node.id,
    };
  },
};
