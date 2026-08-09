/**
 * USGS HANS / VSC volcano alerts — U.S. only (AVO Aleutians neighbor context).
 * Not KVERT. Not JMA.
 */

export const USGS_HANS_API = "https://volcanoes.usgs.gov/hans-public/api/volcano";
export const USGS_HANS_NOTICE_API =
  "https://volcanoes.usgs.gov/hans-public/api/notice";
export const USGS_ELEVATED_URL = `${USGS_HANS_API}/getElevatedVolcanoes`;
export const USGS_VSC_ELEVATED_URL =
  "https://volcanoes.usgs.gov/vsc/api/volcanoApi/elevated";
export const USGS_AVO_NOTICES_URL = `${USGS_HANS_NOTICE_API}/recent/avo/3`;
export const USGS_NEWEST_NOTICES_URL = `${USGS_HANS_NOTICE_API}/getNewestOrRecent`;
export const USGS_VHP_UPDATES_URL =
  "https://www.usgs.gov/programs/VHP/volcano-updates";
export const AVO_SITE_URL = "https://www.avo.alaska.edu/";

export type UsgsColorCode =
  | "GREEN"
  | "YELLOW"
  | "ORANGE"
  | "RED"
  | "UNASSIGNED"
  | "UNKNOWN";

export type UsgsAlertLevel =
  | "NORMAL"
  | "ADVISORY"
  | "WATCH"
  | "WARNING"
  | "UNASSIGNED"
  | "UNKNOWN";

export type UsgsVolcanoAlert = {
  id: string;
  name: string;
  vnum: string;
  volcanoCd: string | null;
  obs: string;
  obsFull: string;
  colorCode: UsgsColorCode;
  alertLevel: UsgsAlertLevel;
  lat: number | null;
  lon: number | null;
  synopsis: string | null;
  threat: string | null;
  noticeUrl: string | null;
  sentAt: number | null;
  isAvo: boolean;
  isPacificNeighbor: boolean;
};

/** Recent AVO notice line for the HANS panel footer. */
export type AvoNoticeLine = {
  id: string;
  typeTitle: string;
  typeCd: string;
  volcanoes: string;
  synopsis: string;
  colorCode: UsgsColorCode | null;
  alertLevel: UsgsAlertLevel | null;
  noticeUrl: string | null;
  sentAt: number | null;
};

export type UsgsVolcanoSnapshot = {
  elevated: UsgsVolcanoAlert[];
  avo: UsgsVolcanoAlert[];
  top: UsgsVolcanoAlert | null;
  elevatedCount: number;
  avoCount: number;
  /** Recent AVO notices (newest first), for panel under elevated list. */
  avoNotices: AvoNoticeLine[];
  fetchedAt: number;
  sourceUrl: string;
  note: string;
  error?: string;
};

const COLOR_RANK: Record<string, number> = {
  RED: 4,
  ORANGE: 3,
  YELLOW: 2,
  GREEN: 1,
  UNASSIGNED: 0,
  UNKNOWN: 0,
};
const ALERT_RANK: Record<string, number> = {
  WARNING: 4,
  WATCH: 3,
  ADVISORY: 2,
  NORMAL: 1,
  UNASSIGNED: 0,
  UNKNOWN: 0,
};

export function emptyUsgsVolcano(error?: string): UsgsVolcanoSnapshot {
  return {
    elevated: [],
    avo: [],
    top: null,
    elevatedCount: 0,
    avoCount: 0,
    avoNotices: [],
    fetchedAt: Date.now(),
    sourceUrl: USGS_VSC_ELEVATED_URL,
    note: "USGS HANS · U.S. volcanoes only (AVO Aleutians primary). Kamchatka–Kurils: KVERT. Japan: JMA.",
    error,
  };
}

function normColor(raw: unknown): UsgsColorCode {
  const s = String(raw ?? "UNKNOWN").toUpperCase();
  if (s === "GREEN" || s === "YELLOW" || s === "ORANGE" || s === "RED") return s;
  if (s === "UNASSIGNED") return "UNASSIGNED";
  return "UNKNOWN";
}

function normAlert(raw: unknown): UsgsAlertLevel {
  const s = String(raw ?? "UNKNOWN").toUpperCase();
  if (s === "NORMAL" || s === "ADVISORY" || s === "WATCH" || s === "WARNING")
    return s;
  if (s === "UNASSIGNED") return "UNASSIGNED";
  return "UNKNOWN";
}

function parseTime(sentUtc: unknown, unixtime: unknown): number | null {
  if (typeof unixtime === "number" && Number.isFinite(unixtime)) {
    return unixtime > 1e12 ? unixtime : unixtime * 1000;
  }
  if (typeof sentUtc === "string" && sentUtc.trim()) {
    const t = Date.parse(
      sentUtc.includes("T") ? sentUtc : sentUtc.replace(" ", "T") + "Z",
    );
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isPacificNeighbor(
  lat: number | null,
  lon: number | null,
  obs: string,
): boolean {
  if (obs === "avo" || obs === "nmi") return true;
  if (lat == null || lon == null) return false;
  if (lat >= 48 && lat <= 64 && lon >= -180 && lon <= -150) return true;
  if (lat >= 48 && lat <= 64 && lon >= 165 && lon <= 180) return true;
  if (lat >= 13 && lat <= 22 && lon >= 140 && lon <= 150) return true;
  return false;
}

function rankAlert(a: UsgsVolcanoAlert): number {
  return (COLOR_RANK[a.colorCode] ?? 0) * 10 + (ALERT_RANK[a.alertLevel] ?? 0);
}

export function parseVscElevated(data: unknown): UsgsVolcanoAlert[] {
  if (!Array.isArray(data)) return [];
  const out: UsgsVolcanoAlert[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.vName ?? r.volcano_name ?? "").trim();
    if (!name) continue;
    const obs = String(r.obs ?? r.obs_abbr ?? "").toLowerCase();
    const lat =
      r.lat != null
        ? Number(r.lat)
        : r.latitude != null
          ? Number(r.latitude)
          : null;
    const lon =
      r.long != null
        ? Number(r.long)
        : r.lon != null
          ? Number(r.lon)
          : r.longitude != null
            ? Number(r.longitude)
            : null;
    const vnum = String(r.vnum ?? "");
    out.push({
      id: String(r.noticeId ?? r.notice_identifier ?? `${vnum}-${name}`),
      name,
      vnum,
      volcanoCd:
        r.volcanoCd != null
          ? String(r.volcanoCd)
          : r.volcano_cd != null
            ? String(r.volcano_cd)
            : null,
      obs,
      obsFull: String(r.obs_fullname ?? obs.toUpperCase()),
      colorCode: normColor(r.colorCode ?? r.color_code),
      alertLevel: normAlert(r.alertLevel ?? r.alert_level),
      lat: lat != null && Number.isFinite(lat) ? lat : null,
      lon: lon != null && Number.isFinite(lon) ? lon : null,
      synopsis: r.noticeSynopsis != null ? String(r.noticeSynopsis) : null,
      threat: r.nvewsThreat != null ? String(r.nvewsThreat) : null,
      noticeUrl:
        r.noticeUrl != null
          ? String(r.noticeUrl)
          : r.notice_url != null
            ? String(r.notice_url)
            : null,
      sentAt: parseTime(r.sentUtc ?? r.sent_utc, r.sent_unixtime),
      isAvo: obs === "avo",
      isPacificNeighbor: isPacificNeighbor(
        lat != null && Number.isFinite(lat) ? lat : null,
        lon != null && Number.isFinite(lon) ? lon : null,
        obs,
      ),
    });
  }
  return out.sort(
    (a, b) => rankAlert(b) - rankAlert(a) || a.name.localeCompare(b.name),
  );
}

export function parseHansElevated(data: unknown): UsgsVolcanoAlert[] {
  if (!Array.isArray(data)) return [];
  const out: UsgsVolcanoAlert[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.volcano_name ?? "").trim();
    if (!name) continue;
    const obs = String(r.obs_abbr ?? "").toLowerCase();
    const vnum = String(r.vnum ?? "");
    out.push({
      id: String(r.notice_identifier ?? `${vnum}-${name}`),
      name,
      vnum,
      volcanoCd: null,
      obs,
      obsFull: String(r.obs_fullname ?? obs.toUpperCase()),
      colorCode: normColor(r.color_code),
      alertLevel: normAlert(r.alert_level),
      lat: null,
      lon: null,
      synopsis: null,
      threat: null,
      noticeUrl: r.notice_url != null ? String(r.notice_url) : null,
      sentAt: parseTime(r.sent_utc, r.sent_unixtime),
      isAvo: obs === "avo",
      isPacificNeighbor: obs === "avo" || obs === "nmi",
    });
  }
  return out.sort((a, b) => rankAlert(b) - rankAlert(a));
}

/**
 * Parse getNewestOrRecent (or similar) into AVO notice lines with synopsis text.
 */
export function parseAvoNotices(data: unknown, limit = 4): AvoNoticeLine[] {
  if (!Array.isArray(data)) return [];
  const out: AvoNoticeLine[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const obs = String(r.obs ?? r.obs_abbr ?? "").toLowerCase();
    if (obs && obs !== "avo") continue;
    const id = String(
      r.noticeIdentifier ?? r.notice_identifier ?? r.noticeId ?? "",
    );
    if (!id) continue;

    const sections = Array.isArray(r.sections) ? r.sections : [];
    const synParts: string[] = [];
    let color: UsgsColorCode | null = null;
    let alert: UsgsAlertLevel | null = null;
    const volNames: string[] = [];

    for (const sec of sections) {
      if (!sec || typeof sec !== "object") continue;
      const s = sec as Record<string, unknown>;
      const syn = String(
        s.synopsis_complete ?? s.synopsis ?? s.summary ?? "",
      ).trim();
      if (syn) synParts.push(stripHtml(syn));
      if (s.colorCode != null || s.color_code != null)
        color = normColor(s.colorCode ?? s.color_code);
      if (s.alertLevel != null || s.alert_level != null)
        alert = normAlert(s.alertLevel ?? s.alert_level);
      const vn = String(s.volcanoName ?? s.volcano_name ?? "").trim();
      if (vn) volNames.push(vn);
    }

    let synopsis = synParts[0] ?? "";
    if (!synopsis && r.misc != null) synopsis = stripHtml(String(r.misc));
    if (!synopsis) {
      synopsis = String(r.notice_type_title ?? r.noticeType ?? "").trim();
    }

    const volcanoes =
      volNames.length > 0
        ? volNames.join(", ")
        : String(r.volcanoes ?? r.volcano_cds_csv ?? "").trim();

    out.push({
      id,
      typeTitle: String(
        r.noticeType ?? r.notice_type_title ?? r.noticeTypeCd ?? "Notice",
      ),
      typeCd: String(r.noticeTypeCd ?? r.notice_type_cd ?? ""),
      volcanoes,
      synopsis,
      colorCode: color,
      alertLevel: alert,
      noticeUrl:
        r.notice_url != null
          ? String(r.notice_url)
          : id
            ? `https://volcanoes.usgs.gov/hans-public/notice/${id}`
            : null,
      sentAt: parseTime(
        r.sentUtc ?? r.sent_utc,
        r.sent_unixtime ?? r.sentUnixtime,
      ),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Enrich thin recent/avo rows with getNoticeFormatted section synopsis.
 */
export function parseNoticeFormatted(
  data: unknown,
  meta?: {
    id?: string;
    typeTitle?: string;
    noticeUrl?: string | null;
    sentAt?: number | null;
  },
): AvoNoticeLine | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  const id = String(r.notice_identifier ?? meta?.id ?? "");
  if (!id) return null;
  const sections = Array.isArray(r.sections) ? r.sections : [];
  const synParts: string[] = [];
  let color: UsgsColorCode | null = null;
  let alert: UsgsAlertLevel | null = null;
  const volNames: string[] = [];
  for (const sec of sections) {
    if (!sec || typeof sec !== "object") continue;
    const s = sec as Record<string, unknown>;
    const syn = String(
      s.synopsis_complete ?? s.synopsis ?? s.summary ?? "",
    ).trim();
    if (syn) synParts.push(stripHtml(syn));
    if (s.color_code != null || s.colorCode != null)
      color = normColor(s.color_code ?? s.colorCode);
    if (s.alert_level != null || s.alertLevel != null)
      alert = normAlert(s.alert_level ?? s.alertLevel);
  }
  return {
    id,
    typeTitle: meta?.typeTitle ?? String(r.notice_type_cd ?? "Notice"),
    typeCd: String(r.notice_type_cd ?? ""),
    volcanoes: volNames.join(", "),
    synopsis: synParts[0] ?? "",
    colorCode: color,
    alertLevel: alert,
    noticeUrl:
      meta?.noticeUrl ??
      `https://volcanoes.usgs.gov/hans-public/notice/${id}`,
    sentAt: meta?.sentAt ?? parseTime(r.sent_utc, null),
  };
}

export function buildUsgsVolcanoSnapshot(
  elevated: UsgsVolcanoAlert[],
  opts?: {
    error?: string;
    sourceUrl?: string;
    avoNotices?: AvoNoticeLine[];
  },
): UsgsVolcanoSnapshot {
  const avo = elevated.filter((v) => v.isAvo);
  return {
    elevated,
    avo,
    top: elevated[0] ?? null,
    elevatedCount: elevated.length,
    avoCount: avo.length,
    avoNotices: opts?.avoNotices ?? [],
    fetchedAt: Date.now(),
    sourceUrl: opts?.sourceUrl ?? USGS_VSC_ELEVATED_URL,
    note: "USGS HANS · U.S. only (AVO Aleutians primary). Kamchatka–Kurils: KVERT. Japan: JMA.",
    error: opts?.error,
  };
}

export function colorHex(code: UsgsColorCode): string {
  switch (code) {
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

export function badgeVariantForColor(
  code: UsgsColorCode,
): "critical" | "warn" | "live" | "outline" {
  if (code === "RED" || code === "ORANGE") return "critical";
  if (code === "YELLOW") return "warn";
  if (code === "GREEN") return "live";
  return "outline";
}
