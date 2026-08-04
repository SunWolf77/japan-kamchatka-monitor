/**
 * INGV–Osservatorio Vesuviano GOSSIP catalog
 * https://terremoti.ov.ingv.it/gossip/flegrei/
 *
 * Dense local Campi Flegrei catalog used by the official
 * "Localizzazioni Sismiche" map (includes events without magnitude / N/D).
 */

import type { FetchResult, QuakeEvent, SeismicQuery } from "../types";
import type { SeismicProvider } from "./base";

const GOSSIP_BASE = "https://terremoti.ov.ingv.it/gossip";

export function gossipYearUrl(year: number, format: "csv" | "json" = "csv"): string {
  return `${GOSSIP_BASE}/flegrei/${year}/events.${format}`;
}

export function gossipOfficialMapUrl(year?: number): string {
  const y = year ?? new Date().getUTCFullYear();
  return `${GOSSIP_BASE}/flegrei/${y}/`;
}

function parseNum(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "N/D" || s === "-" || s === "--") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV header (GOSSIP public export):
 * #EventID,Time,Latitude,Longitude,Depth,MD,MD Error,Area,Type,Level
 */
export function parseGossipCsv(text: string): QuakeEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const events: QuakeEvent[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.toLowerCase().startsWith("eventid")) continue;
    const cols = line.split(",");
    if (cols.length < 8) continue;

    const [
      eventId,
      timeStr,
      latStr,
      lonStr,
      depthStr,
      mdStr,
      mdErrStr,
      area,
      eventType,
      level,
    ] = cols.map((c) => c?.trim());

    const latitude = parseNum(latStr);
    const longitude = parseNum(lonStr);
    // Unlocalized detections have empty lat/lon — skip for map/catalog geometry
    if (latitude == null || longitude == null) continue;
    // Guard against bogus 0,0 (equator) in this regional catalog
    if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) continue;

    const depthKm = parseNum(depthStr) ?? 0;
    const magnitude = parseNum(mdStr);

    const iso = (timeStr ?? "").includes("T")
      ? timeStr
      : (timeStr ?? "").replace(" ", "T");
    const time = Date.parse(iso?.endsWith("Z") ? iso : `${iso}Z`);

    if (!eventId || !Number.isFinite(time)) continue;

    events.push({
      id: `gossip-${eventId}`,
      time,
      latitude,
      longitude,
      depthKm,
      magnitude,
      magType: magnitude == null ? "N/D" : "Md",
      place:
        area === "flegrei" || area === "Campi Flegrei"
          ? "Campi Flegrei"
          : area || "Campi Flegrei",
      eventType: eventType || "earthquake",
      author: "INGV-OV GOSSIP",
      provider: "gossip",
      catalog: "GOSSIP",
      contributor: level || undefined,
      raw: {
        eventId,
        time: timeStr ?? "",
        mdError: mdErrStr ?? "",
        level: level ?? "",
        area: area ?? "",
      },
    });
  }

  return events;
}

export function parseGossipJson(data: unknown): QuakeEvent[] {
  if (!Array.isArray(data)) return [];
  const events: QuakeEvent[] = [];

  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;

    const eventId = String(r.id ?? r.EventID ?? r.event_id ?? "");
    const lat = parseNum(String(r.lat ?? r.latitude ?? r.Latitude ?? ""));
    const lon = parseNum(String(r.lon ?? r.longitude ?? r.Longitude ?? ""));
    if (lat == null || lon == null) continue;
    if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) continue;

    const depthKm = parseNum(String(r.depth ?? r.Depth ?? r.depth_km ?? "0")) ?? 0;
    const mdRaw = r.md ?? r.MD ?? r.magnitude ?? r.Magnitude;
    const magnitude =
      mdRaw === null || mdRaw === undefined || mdRaw === "" || mdRaw === "N/D"
        ? null
        : Number(mdRaw);

    let time: number;
    if (typeof r.epoch === "number") {
      time = r.epoch > 1e12 ? r.epoch : r.epoch * 1000;
    } else {
      const dateStr = String(r.date ?? r.Time ?? r.time ?? r.printdate ?? "");
      const iso = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
      time = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
    }

    if (!eventId || !Number.isFinite(time)) continue;

    const area = String(r.area ?? "flegrei");
    events.push({
      id: `gossip-${eventId}`,
      time,
      latitude: lat,
      longitude: lon,
      depthKm,
      magnitude: magnitude != null && Number.isFinite(magnitude) ? magnitude : null,
      magType: magnitude == null || !Number.isFinite(magnitude as number) ? "N/D" : "Md",
      place: area === "flegrei" ? "Campi Flegrei" : area,
      eventType: String(r.type ?? "earthquake"),
      author: "INGV-OV GOSSIP",
      provider: "gossip",
      catalog: "GOSSIP",
      contributor: r.level != null ? String(r.level) : undefined,
      raw: {
        eventId,
        level: r.level != null ? String(r.level) : "",
        quality: r.quality != null ? String(r.quality) : "",
      },
    });
  }

  return events;
}

function yearsSpanned(start: Date, end: Date): number[] {
  const ys: number[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) ys.push(y);
  return ys.length ? ys : [new Date().getUTCFullYear()];
}

async function fetchYear(year: number): Promise<{ events: QuakeEvent[]; url: string }> {
  const csvUrl = gossipYearUrl(year, "csv");
  try {
    const res = await fetch(csvUrl, {
      headers: { Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
    });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.startsWith("<!") && text.includes(",")) {
        return { events: parseGossipCsv(text), url: csvUrl };
      }
    }
  } catch {
    // fall through
  }

  const jsonUrl = gossipYearUrl(year, "json");
  const res = await fetch(jsonUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GOSSIP ${res.status}: ${res.statusText} (${jsonUrl})`);
  }
  const data = await res.json();
  return { events: parseGossipJson(data), url: jsonUrl };
}

export const gossipProvider: SeismicProvider = {
  id: "gossip",
  label: "INGV-OV GOSSIP (Campi Flegrei)",
  async fetchEvents(query: SeismicQuery): Promise<FetchResult> {
    const years = yearsSpanned(query.start, query.end);
    const all: QuakeEvent[] = [];
    const urls: string[] = [];

    for (const y of years) {
      const { events, url } = await fetchYear(y);
      urls.push(url);
      all.push(...events);
    }

    const startMs = query.start.getTime();
    const endMs = query.end.getTime();
    const minMag = query.minMagnitude;

    let filtered = all.filter((e) => e.time >= startMs && e.time <= endMs);
    if (minMag != null && Number.isFinite(minMag)) {
      filtered = filtered.filter((e) => e.magnitude != null && e.magnitude >= minMag);
    }

    const byId = new Map<string, QuakeEvent>();
    for (const e of filtered) byId.set(e.id, e);
    const events = [...byId.values()].sort((a, b) => b.time - a.time);

    const limit = query.limit ?? 5000;
    const sliced = events.slice(0, limit);

    return {
      events: sliced,
      provider: "gossip",
      fetchedAt: Date.now(),
      sourceUrl: urls.join(" | "),
      count: sliced.length,
      window: { start: query.start.toISOString(), end: query.end.toISOString() },
      nodeId: query.node.id,
    };
  },
};
