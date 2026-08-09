/**
 * USGS HANS / VSC volcano alerts — U.S. only (AVO Aleutians neighbor context).
 * Not KVERT. Not JMA.
 */

export const USGS_HANS_API = "https://volcanoes.usgs.gov/hans-public/api/volcano";
export const USGS_ELEVATED_URL = `${USGS_HANS_API}/getElevatedVolcanoes`;
export const USGS_VSC_ELEVATED_URL = "https://volcanoes.usgs.gov/vsc/api/getElevatedVolcanoes";
export const USGS_HANS_PAGE = "https://volcanoes.usgs.gov/hans-public/";
export const AVO_PAGE = "https://avo.alaska.edu/";

export type UsgsAlertLevel = "NORMAL" | "ADVISORY" | "WATCH" | "WARNING" | "UNASSIGNED" | "UNKNOWN";
export type UsgsAviationColour = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "UNASSIGNED" | "UNKNOWN";

export type UsgsVolcanoAlert = {
  volcanoId: string;
  name: string;
  region: string;
  alertLevel: UsgsAlertLevel;
  aviationColour: UsgsAviationColour;
  elevated: boolean;
  lat?: number | null;
  lon?: number | null;
  synopsis?: string | null;
  source: "HANS" | "VSC";
  href?: string | null;
};

export type UsgsVolcanoSnapshot = {
  elevated: UsgsVolcanoAlert[];
  all: UsgsVolcanoAlert[];
  counts: { elevated: number; byAlert: Record<string, number>; byColour: Record<string, number> };
  fetchedAt: number;
  note: string;
  error?: string;
};

export function emptyUsgsVolcano(error?: string): UsgsVolcanoSnapshot {
  return {
    elevated: [],
    all: [],
    counts: { elevated: 0, byAlert: {}, byColour: {} },
    fetchedAt: Date.now(),
    note: "USGS HANS / VSC · U.S. volcanoes only (AVO Aleutians neighbor). Not KVERT.",
    error,
  };
}

function normAlert(raw: string | null | undefined): UsgsAlertLevel {
  const s = (raw || "").toUpperCase();
  if (s === "NORMAL" || s === "ADVISORY" || s === "WATCH" || s === "WARNING" || s === "UNASSIGNED") return s;
  return "UNKNOWN";
}

function normColour(raw: string | null | undefined): UsgsAviationColour {
  const s = (raw || "").toUpperCase();
  if (s === "GREEN" || s === "YELLOW" || s === "ORANGE" || s === "RED" || s === "UNASSIGNED") return s;
  return "UNKNOWN";
}

function isElevated(alert: UsgsAlertLevel, colour: UsgsAviationColour): boolean {
  return (
    alert === "ADVISORY" ||
    alert === "WATCH" ||
    alert === "WARNING" ||
    colour === "YELLOW" ||
    colour === "ORANGE" ||
    colour === "RED"
  );
}

function parseOne(raw: any, source: "HANS" | "VSC"): UsgsVolcanoAlert | null {
  if (!raw || typeof raw !== "object") return null;
  const name =
    raw.volcanoName || raw.vname || raw.name || raw.VolcanoName || raw.volcano || "";
  if (!name) return null;
  const alertLevel = normAlert(
    raw.alertLevel || raw.alert_level || raw.AlertLevel || raw.colorCode || raw.color,
  );
  const aviationColour = normColour(
    raw.aviationColor || raw.aviation_color || raw.AviationColor || raw.colorCode || raw.color,
  );
  const region =
    raw.region || raw.Region || raw.area || raw.network || (source === "HANS" ? "U.S." : "VSC");
  const lat = Number(raw.lat ?? raw.latitude ?? raw.Latitude ?? NaN);
  const lon = Number(raw.lon ?? raw.longitude ?? raw.Longitude ?? NaN);
  const volcanoId = String(raw.volcanoId || raw.vnum || raw.id || name).replace(/\s+/g, "_");
  const synopsis =
    raw.synopsis || raw.notice || raw.product || raw.summary || raw.Status || null;
  return {
    volcanoId,
    name: String(name).trim(),
    region: String(region).trim(),
    alertLevel,
    aviationColour,
    elevated: isElevated(alertLevel, aviationColour),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    synopsis: synopsis ? String(synopsis).slice(0, 400) : null,
    source,
    href:
      raw.url ||
      raw.noticeUrl ||
      `https://volcanoes.usgs.gov/volcanoes/${encodeURIComponent(volcanoId)}/`,
  };
}

/** Prefer AVO / Aleutians + Pacific U.S. elevated; keep all elevated for counts. */
export function parseUsgsElevated(json: any, source: "HANS" | "VSC" = "HANS"): UsgsVolcanoSnapshot {
  let list: any[] = [];
  if (Array.isArray(json)) list = json;
  else if (json && Array.isArray(json.volcanoes)) list = json.volcanoes;
  else if (json && Array.isArray(json.data)) list = json.data;
  else if (json && typeof json === "object") list = Object.values(json).filter(Array.isArray).flat();

  const all: UsgsVolcanoAlert[] = [];
  for (const item of list) {
    const parsed = parseOne(item, source);
    if (parsed) all.push(parsed);
  }

  // Prefer unique by name, AVO/HANS first
  const byName = new Map<string, UsgsVolcanoAlert>();
  for (const a of all) {
    const key = a.name.toUpperCase();
    const prev = byName.get(key);
    if (!prev || (a.source === "HANS" && prev.source !== "HANS")) byName.set(key, a);
  }
  const unique = [...byName.values()];
  const elevated = unique.filter((a) => a.elevated);

  const byAlert: Record<string, number> = {};
  const byColour: Record<string, number> = {};
  for (const a of elevated) {
    byAlert[a.alertLevel] = (byAlert[a.alertLevel] ?? 0) + 1;
    byColour[a.aviationColour] = (byColour[a.aviationColour] ?? 0) + 1;
  }

  return {
    elevated,
    all: unique,
    counts: { elevated: elevated.length, byAlert, byColour },
    fetchedAt: Date.now(),
    note: "USGS HANS / VSC · U.S. volcanoes only (AVO Aleutians neighbor). Not KVERT.",
  };
}

export function alertBadgeVariant(
  level: UsgsAlertLevel,
): "critical" | "warn" | "live" | "outline" {
  if (level === "WARNING" || level === "WATCH") return "critical";
  if (level === "ADVISORY") return "warn";
  if (level === "NORMAL") return "live";
  return "outline";
}

export function colourHexUsgs(c: UsgsAviationColour): string {
  switch (c) {
    case "RED":
      return "#e53935";
    case "ORANGE":
      return "#fb8c00";
    case "YELLOW":
      return "#fdd835";
    case "GREEN":
      return "#43a047";
    default:
      return "#90a4ae";
  }
}
