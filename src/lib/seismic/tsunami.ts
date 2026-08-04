/**
 * Tsunami watch layer — new for SES Japan–Kamchatka node #3.
 * Sources:
 *  - JMA Bosai tsunami list (VTSE products)
 *  - USGS M≥6 in NW Pacific as potential source events
 */

export type TsunamiStatus =
  | "none"
  | "information"
  | "advisory"
  | "warning"
  | "major_warning"
  | "cancel";

export type TsunamiBulletin = {
  id: string;
  time: number;
  title: string;
  titleEn: string;
  area: string;
  areaEn: string;
  status: TsunamiStatus;
  kindCodes: string[];
  eventId: string;
  mag: number | null;
  lat: number | null;
  lon: number | null;
  depthKm: number | null;
  source: "jma";
  json?: string | null;
};

export type TsunamiWatchSnapshot = {
  bulletins: TsunamiBulletin[];
  active: TsunamiBulletin[];
  highest: TsunamiStatus;
  fetchedAt: number;
  sourceUrl: string;
  error?: string;
};

const JMA_TSUNAMI_LIST = "https://www.jma.go.jp/bosai/tsunami/data/list.json";

type JmaTsunamiItem = {
  ctt?: string;
  eid?: string;
  rdt?: string;
  at?: string;
  ttl?: string;
  en_ttl?: string;
  anm?: string;
  en_anm?: string;
  cod?: string;
  mag?: string;
  json?: string;
  kind?: { code?: string; kind?: string }[];
  ift?: string;
  ser?: string | number;
};

function parseJstToMs(s: string | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function parseCod(cod?: string): { lat: number; lon: number; depthKm: number } | null {
  if (!cod) return null;
  const m = String(cod).match(
    /([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)\/?/,
  );
  if (!m) return null;
  const lat = parseFloat(m[1]!);
  const lon = parseFloat(m[2]!);
  const depthM = parseFloat(m[3]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    depthKm: Number.isFinite(depthM) ? Math.abs(depthM) / 1000 : 0,
  };
}

function classifyStatus(item: JmaTsunamiItem): TsunamiStatus {
  const title = `${item.ttl || ""} ${item.en_ttl || ""} ${item.kind?.map((k) => k.kind).join(" ") || ""}`;
  const codes = (item.kind || []).map((k) => k.code || "").join(" ");
  const blob = `${title} ${codes}`;
  if (/解除|cancel|cleared|取消/i.test(blob)) return "cancel";
  if (/大津波警報|major/i.test(blob)) return "major_warning";
  if (/津波警報|warning/i.test(blob) && !/注意/i.test(blob)) return "warning";
  if (/津波注意報|advisory|注意/i.test(blob)) return "advisory";
  if (/予報|forecast|情報|information/i.test(blob)) return "information";
  return "information";
}

const STATUS_RANK: Record<TsunamiStatus, number> = {
  none: 0,
  cancel: 1,
  information: 2,
  advisory: 3,
  warning: 4,
  major_warning: 5,
};

export function statusLabel(s: TsunamiStatus): string {
  switch (s) {
    case "major_warning":
      return "Major tsunami warning";
    case "warning":
      return "Tsunami warning";
    case "advisory":
      return "Tsunami advisory";
    case "information":
      return "Tsunami forecast / info";
    case "cancel":
      return "Cancelled / lifted";
    default:
      return "No active bulletin";
  }
}

export function statusTone(s: TsunamiStatus): "ok" | "info" | "warn" | "danger" {
  if (s === "major_warning" || s === "warning") return "danger";
  if (s === "advisory") return "warn";
  if (s === "information") return "info";
  return "ok";
}

function mapItem(item: JmaTsunamiItem): TsunamiBulletin | null {
  const time = parseJstToMs(item.at) ?? parseJstToMs(item.rdt) ?? parseJstToMs(item.ctt);
  if (time == null) return null;
  const coords = parseCod(item.cod);
  const magRaw = item.mag?.trim();
  const mag =
    magRaw && magRaw !== "不明" && magRaw !== "-"
      ? parseFloat(magRaw)
      : NaN;
  const eid = (item.eid || item.ctt || "").trim();
  if (!eid) return null;
  return {
    id: `jma-tsu-${item.ctt || eid}-${item.ser ?? 0}`,
    time,
    title: item.ttl || "津波情報",
    titleEn: item.en_ttl || "Tsunami bulletin",
    area: item.anm || "",
    areaEn: item.en_anm || item.anm || "Japan region",
    status: classifyStatus(item),
    kindCodes: (item.kind || []).map((k) => k.code || "").filter(Boolean),
    eventId: eid,
    mag: Number.isFinite(mag) ? mag : null,
    lat: coords?.lat ?? null,
    lon: coords?.lon ?? null,
    depthKm: coords?.depthKm ?? null,
    source: "jma",
    json: item.json || null,
  };
}

export async function fetchJmaTsunami(opts?: {
  maxAgeMs?: number;
}): Promise<TsunamiWatchSnapshot> {
  const maxAge = opts?.maxAgeMs ?? 14 * 86_400_000;
  const now = Date.now();
  try {
    const res = await fetch(`${JMA_TSUNAMI_LIST}?_=${now}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`JMA tsunami ${res.status}`);
    const data = (await res.json()) as JmaTsunamiItem[];
    if (!Array.isArray(data)) throw new Error("Tsunami list not array");

    const bulletins = data
      .map(mapItem)
      .filter((b): b is TsunamiBulletin => !!b)
      .filter((b) => now - b.time <= maxAge)
      .sort((a, b) => b.time - a.time);

    // Active = non-cancel, latest per eventId
    const seen = new Set<string>();
    const active: TsunamiBulletin[] = [];
    for (const b of bulletins) {
      if (seen.has(b.eventId)) continue;
      seen.add(b.eventId);
      if (b.status !== "cancel" && b.status !== "none") active.push(b);
    }

    let highest: TsunamiStatus = "none";
    for (const b of active) {
      if (STATUS_RANK[b.status] > STATUS_RANK[highest]) highest = b.status;
    }

    return {
      bulletins: bulletins.slice(0, 40),
      active,
      highest,
      fetchedAt: now,
      sourceUrl: JMA_TSUNAMI_LIST,
    };
  } catch (err) {
    return {
      bulletins: [],
      active: [],
      highest: "none",
      fetchedAt: now,
      sourceUrl: JMA_TSUNAMI_LIST,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Potential tsunami sources: large/shallow NW Pacific events from catalog. */
export function potentialTsunamiSources(
  events: {
    id: string;
    magnitude: number | null;
    depthKm: number;
    time: number;
    place: string;
    latitude: number;
    longitude: number;
  }[],
  opts?: { minMag?: number; maxDepthKm?: number; maxAgeMs?: number },
) {
  const minMag = opts?.minMag ?? 6.0;
  const maxDepth = opts?.maxDepthKm ?? 100;
  const maxAge = opts?.maxAgeMs ?? 7 * 86_400_000;
  const now = Date.now();
  return events
    .filter(
      (e) =>
        e.magnitude != null &&
        e.magnitude >= minMag &&
        e.depthKm <= maxDepth &&
        now - e.time <= maxAge,
    )
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, 12);
}
