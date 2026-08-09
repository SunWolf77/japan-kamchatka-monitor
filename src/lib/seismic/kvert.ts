/**
 * KVERT (Kamchatka Volcanic Eruption Response Team) — ICAO aviation colour codes.
 * Daily: message.php?n=YYYY-MM-DD  |  Weekly: index?type=3 / message.php?n=NN-YYYY
 * Authority for Kamchatka–Kurils volcanoes. Not USGS.
 */

export const KVERT_BASE = "http://kvert.febras.net";
export const KVERT_DAILY_INDEX = `${KVERT_BASE}/van/index.php?type=2&lang=en`;
export const KVERT_WEEKLY_URL = `${KVERT_BASE}/index?type=3`;
export const KVERT_VAN_INDEX = `${KVERT_BASE}/van/index.php?type=1&lang=en`;
export const KVERT_ABOUT = `${KVERT_BASE}/about`;
export const KVERT_COLOR_LEGEND = `${KVERT_BASE}/color`;

export type KvertColour = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "UNASSIGNED" | "UNKNOWN";

export type KvertVolcanoStatus = {
  name: string;
  nameRaw: string;
  colour: KvertColour;
  region: string;
  elevated: boolean;
  cavw?: string;
  lat?: number | null;
  lon?: number | null;
  elevM?: number | null;
  synopsis?: string | null;
  detail?: string | null;
  href?: string | null;
};

export type KvertSnapshot = {
  source: "daily" | "weekly" | "merged";
  reportId: string | null;
  issuedUtc: string | null;
  dailyUrl: string | null;
  weeklyUrl: string;
  elevated: KvertVolcanoStatus[];
  all: KvertVolcanoStatus[];
  counts: { total: number; elevated: number; byColour: Record<string, number> };
  fetchedAt: number;
  note: string;
  error?: string;
};

const COLOUR_RE = String.raw`(?:RED|ORANGE|YELLOW|GREEN|UNASS?IGNED)`;

export function emptyKvert(error?: string): KvertSnapshot {
  return {
    source: "daily",
    reportId: null,
    issuedUtc: null,
    dailyUrl: null,
    weeklyUrl: KVERT_WEEKLY_URL,
    elevated: [],
    all: [],
    counts: { total: 0, elevated: 0, byColour: {} },
    fetchedAt: Date.now(),
    note: "KVERT / IVS FEB RAS · ICAO aviation colour · Kamchatka–Kurils authority. Not USGS.",
    error,
  };
}

function normColour(raw: string): KvertColour {
  const s = raw.toUpperCase().replace("UNASSIGHED", "UNASSIGNED");
  if (s === "GREEN" || s === "YELLOW" || s === "ORANGE" || s === "RED" || s === "UNASSIGNED")
    return s;
  return "UNKNOWN";
}

function titleName(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Index daily report ids from type=2 page. */
export function parseKvertDailyIndex(html: string): Array<{
  id: string;
  label: string;
  url: string;
}> {
  const out: Array<{ id: string; label: string; url: string }> = [];
  const re =
    /showContent\('message\.php\?n=(\d{4}-\d{2}-\d{2})'\)[^>]*>[\s\S]*?(?:&nbsp;)?\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{1,2}:\d{2}\s+UTC)/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) != null) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: m[2]!.trim(),
      url: `${KVERT_BASE}/van/message.php?n=${id}`,
    });
  }
  return out;
}

function parseSummaryEntries(html: string): KvertVolcanoStatus[] {
  const entries: KvertVolcanoStatus[] = [];
  const summaryStart = /SUMMARY\s+OF\s+.*?AVIATION\s+COLOUR\s+CODES/i.exec(html);
  if (!summaryStart) return entries;
  let summaryHtml = html.slice(summaryStart.index + summaryStart[0].length);
  const cut = /<b>[A-Z][A-Z\s]+\s+VOLCANO\s+\(CAVW/i.exec(summaryHtml);
  if (cut) summaryHtml = summaryHtml.slice(0, cut.index);

  const regionRe =
    /<b>\s*(KAMCHATKA|NORTHERN\s+KURILES|CENTRAL\s+KURILES|SOUTHERN\s+KURILES)\s*<\/b>/gi;
  const lineRe = new RegExp(
    `([A-Z][A-Z0-9 ,.\\-']+?):\s*(?:<span[^>]*>)?\s*(${COLOUR_RE})\s*(?:</span>)?`,
    "gi",
  );
  const parts = summaryHtml.split(regionRe);
  for (let i = 1; i < parts.length; i += 2) {
    const region = parts[i]!.replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
    const body = parts[i + 1] ?? "";
    let lm: RegExpExecArray | null;
    const lr = new RegExp(lineRe.source, "gi");
    while ((lm = lr.exec(body)) != null) {
      const colour = normColour(lm[2]!);
      const names = lm[1]!
        .split(/,\s*/)
        .map((n) => n.trim())
        .filter(Boolean);
      for (const nameRaw of names) {
        entries.push({
          name: titleName(nameRaw),
          nameRaw,
          colour,
          region,
          elevated: colour === "YELLOW" || colour === "ORANGE" || colour === "RED",
        });
      }
    }
  }
  return entries;
}

function parseDetailBlocks(html: string): KvertVolcanoStatus[] {
  const details: KvertVolcanoStatus[] = [];
  const blockRe =
    /<b>\s*([A-Z][A-Z\s\-]+)\s+VOLCANO\s+\(CAVW\s*#(\d+)\)\s*<br\s*\/?>\s*([\s\S]*?)<\/b>\s*<br\s*\/?>\s*([\s\S]*?)(?=<b>\s*[A-Z][A-Z\s\-]+\s+VOLCANO\s+\(CAVW|IF YOU HAVE ANY QUESTIONS|CONTACT INFORMATION|$)/gi;
  let bm: RegExpExecArray | null;
  while ((bm = blockRe.exec(html)) != null) {
    const nameRaw = bm[1]!.trim();
    const cavw = bm[2]!;
    const head = bm[3]!;
    const body = bm[4]!;
    const loc = /([\d.]+)\s*N,?\s*([\d.]+)\s*E;\s*Elevation\s*([\d.]+)\s*m/i.exec(head);
    const colM = new RegExp(
      `Aviation\\s+Colour\\s+Code\\s+is\\s*(?:&nbsp;|\\u00a0|\\s)*(?:<span[^>]*>)?\\s*(${COLOUR_RE})`,
      "i",
    ).exec(head);
    const colour = colM ? normColour(colM[1]!) : ("UNKNOWN" as KvertColour);
    const paras = body
      .split(/<br\s*\/?>\s*<br\s*\/?>/i)
      .map(stripTags)
      .filter((p) => p && !/^https?:/i.test(p));
    const hrefM = /href="(http[^"]+volc\?[^"]+)"/i.exec(body);
    details.push({
      name: titleName(nameRaw),
      nameRaw,
      colour,
      region: "Kamchatka",
      elevated: colour === "YELLOW" || colour === "ORANGE" || colour === "RED",
      cavw,
      lat: loc ? Number(loc[1]) : null,
      lon: loc ? Number(loc[2]) : null,
      elevM: loc ? Number(loc[3]) : null,
      synopsis: paras[0] ?? null,
      detail: paras[1] ?? null,
      href:
        hrefM?.[1] ??
        `${KVERT_BASE}/volc?lang=en&name=${encodeURIComponent(nameRaw.replace(/\s+/g, ""))}`,
    });
  }
  return details;
}

function parseIssued(html: string): string | null {
  const m =
    /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}:\d{2})\s+UTC/.exec(html) ||
    /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),\s+all time is UTC/i.exec(html);
  if (!m) return null;
  try {
    const time = m[4] && m[4].includes(":") ? m[4] : "00:00";
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} ${time} UTC`);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

function mergeEntries(
  summary: KvertVolcanoStatus[],
  details: KvertVolcanoStatus[],
): KvertVolcanoStatus[] {
  if (!summary.length) return details;
  const byRaw = new Map(summary.map((e) => [e.nameRaw.toUpperCase(), { ...e }]));
  for (const d of details) {
    const key = d.nameRaw.toUpperCase();
    const prev = byRaw.get(key);
    if (prev) {
      byRaw.set(key, { ...prev, ...d, region: prev.region || d.region });
    } else {
      byRaw.set(key, d);
    }
  }
  return [...byRaw.values()];
}

function buildCounts(all: KvertVolcanoStatus[]) {
  const byColour: Record<string, number> = {};
  for (const e of all) byColour[e.colour] = (byColour[e.colour] ?? 0) + 1;
  const elevated = all.filter((e) => e.elevated);
  return { total: all.length, elevated: elevated.length, byColour };
}

/** Parse daily message body (elevated detail blocks only). */
export function parseKvertDailyMessage(html: string, reportId?: string): KvertSnapshot {
  const details = parseDetailBlocks(html);
  const summary = parseSummaryEntries(html);
  const all = mergeEntries(summary, details);
  const elevated = all.filter((e) => e.elevated);
  const id =
    reportId ??
    (/KVERT\s+DAILY\s+REPORT\s+(\d{4}-\d{2}-\d{2})/i.exec(html)?.[1] ?? null);
  return {
    source: "daily",
    reportId: id,
    issuedUtc: parseIssued(html),
    dailyUrl: id ? `${KVERT_BASE}/van/message.php?n=${id}` : null,
    weeklyUrl: KVERT_WEEKLY_URL,
    elevated,
    all,
    counts: buildCounts(all.length ? all : elevated),
    fetchedAt: Date.now(),
    note: "KVERT Daily · ICAO aviation colour · Kamchatka–Kurils authority. Not USGS.",
  };
}

/** Parse weekly release HTML (full colour inventory + details). */
export function parseKvertWeeklyHtml(html: string): KvertSnapshot {
  const summary = parseSummaryEntries(html);
  const details = parseDetailBlocks(html);
  const all = mergeEntries(summary, details);
  const elevated = all.filter((e) => e.elevated);
  const rel = /KVERT\s+WEEKLY\s+INFORMATION\s+RELEASE\s+(\d+-\d{4})/i.exec(html);
  return {
    source: "weekly",
    reportId: rel?.[1] ?? null,
    issuedUtc: parseIssued(html),
    dailyUrl: null,
    weeklyUrl: KVERT_WEEKLY_URL,
    elevated,
    all,
    counts: buildCounts(all),
    fetchedAt: Date.now(),
    note: "KVERT Weekly · full ICAO colour inventory · Kamchatka–Kurils. Not USGS.",
  };
}

/** Prefer daily elevated + attach weekly full list when available. */
export function mergeKvertSnapshots(
  daily: KvertSnapshot | null,
  weekly: KvertSnapshot | null,
): KvertSnapshot {
  if (daily && !weekly) return daily;
  if (weekly && !daily) return weekly;
  if (!daily && !weekly) return emptyKvert("No KVERT data");
  const elevated =
    daily!.elevated.length > 0 ? daily!.elevated : weekly!.elevated;
  const all = weekly!.all.length > 0 ? weekly!.all : daily!.all;
  // Prefer daily synopsis on matching names
  const dailyBy = new Map(daily!.elevated.map((e) => [e.nameRaw.toUpperCase(), e]));
  const elevatedMerged = elevated.map((e) => {
    const d = dailyBy.get(e.nameRaw.toUpperCase());
    return d ? { ...e, ...d } : e;
  });
  return {
    source: "merged",
    reportId: daily!.reportId ?? weekly!.reportId,
    issuedUtc: daily!.issuedUtc ?? weekly!.issuedUtc,
    dailyUrl: daily!.dailyUrl,
    weeklyUrl: KVERT_WEEKLY_URL,
    elevated: elevatedMerged,
    all,
    counts: {
      total: all.length || elevatedMerged.length,
      elevated: elevatedMerged.length,
      byColour:
        all.length > 0
          ? buildCounts(all).byColour
          : buildCounts(elevatedMerged).byColour,
    },
    fetchedAt: Date.now(),
    note: "KVERT daily + weekly · ICAO aviation colour · Kamchatka–Kurils authority. Not USGS.",
    error: daily!.error || weekly!.error,
  };
}

export function colourHex(c: KvertColour): string {
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

export function badgeVariantForColour(
  c: KvertColour,
): "critical" | "warn" | "live" | "outline" {
  if (c === "RED" || c === "ORANGE") return "critical";
  if (c === "YELLOW") return "warn";
  if (c === "GREEN") return "live";
  return "outline";
}
