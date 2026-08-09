import { createServerFn } from "@tanstack/react-start";
import {
  USGS_AVO_NOTICES_URL,
  USGS_ELEVATED_URL,
  USGS_HANS_NOTICE_API,
  USGS_NEWEST_NOTICES_URL,
  USGS_VSC_ELEVATED_URL,
  buildUsgsVolcanoSnapshot,
  emptyUsgsVolcano,
  parseAvoNotices,
  parseHansElevated,
  parseNoticeFormatted,
  parseVscElevated,
  type AvoNoticeLine,
  type UsgsVolcanoSnapshot,
} from "./usgsVolcano";

const UA =
  "SES-Japan-Kamchatka-Monitor/0.1 (observational; +https://github.com/SunWolf77/japan-kamchatka-monitor)";

let mem: { at: number; snap: UsgsVolcanoSnapshot } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(14_000),
  });
  if (!res.ok) throw new Error(`USGS volcano ${res.status}`);
  return res.json();
}

/** Prefer getNewestOrRecent (has section synopsis); fall back to recent/avo + format. */
async function fetchAvoNotices(): Promise<AvoNoticeLine[]> {
  try {
    const newest = await fetchJson(USGS_NEWEST_NOTICES_URL);
    const fromNewest = parseAvoNotices(newest, 4);
    if (fromNewest.some((n) => n.synopsis.length > 8)) return fromNewest;
  } catch {
    /* fall through */
  }

  try {
    const recent = await fetchJson(USGS_AVO_NOTICES_URL);
    if (!Array.isArray(recent) || recent.length === 0) return [];
    const lines: AvoNoticeLine[] = [];
    const top = recent.slice(0, 3);
    for (const row of top) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = String(r.notice_identifier ?? "");
      if (!id) continue;
      const meta = {
        id,
        typeTitle: String(r.notice_type_title ?? "Notice"),
        noticeUrl:
          r.notice_url != null
            ? String(r.notice_url)
            : `https://volcanoes.usgs.gov/hans-public/notice/${id}`,
        sentAt:
          typeof r.sent_unixtime === "number"
            ? r.sent_unixtime > 1e12
              ? r.sent_unixtime
              : r.sent_unixtime * 1000
            : null,
      };
      try {
        const body = await fetchJson(
          `${USGS_HANS_NOTICE_API}/getNoticeFormatted/${encodeURIComponent(id)}/json`,
        );
        const line = parseNoticeFormatted(body, meta);
        if (line) lines.push(line);
      } catch {
        lines.push({
          id,
          typeTitle: meta.typeTitle,
          typeCd: String(r.notice_type_cd ?? ""),
          volcanoes: String(r.volcano_cds_csv ?? ""),
          synopsis: meta.typeTitle,
          colorCode: null,
          alertLevel: null,
          noticeUrl: meta.noticeUrl,
          sentAt: meta.sentAt,
        });
      }
    }
    return lines;
  } catch {
    return [];
  }
}

export const fetchUsgsVolcanoAlerts = createServerFn({ method: "GET" }).handler(
  async (): Promise<UsgsVolcanoSnapshot> => {
    if (mem && Date.now() - mem.at < CACHE_MS) return mem.snap;
    try {
      let elevated;
      let sourceUrl = USGS_VSC_ELEVATED_URL;
      try {
        const raw = await fetchJson(USGS_VSC_ELEVATED_URL);
        elevated = parseVscElevated(raw);
      } catch {
        const raw = await fetchJson(USGS_ELEVATED_URL);
        elevated = parseHansElevated(raw);
        sourceUrl = USGS_ELEVATED_URL;
      }
      const avoNotices = await fetchAvoNotices();
      const snap = buildUsgsVolcanoSnapshot(elevated, {
        sourceUrl,
        avoNotices,
      });
      mem = { at: Date.now(), snap };
      return snap;
    } catch (e) {
      return emptyUsgsVolcano(
        e instanceof Error ? e.message : "USGS volcano fetch failed",
      );
    }
  },
);
