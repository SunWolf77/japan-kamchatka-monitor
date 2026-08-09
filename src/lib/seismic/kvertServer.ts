/**
 * Server: KVERT daily + weekly aviation colour snapshot.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  KVERT_DAILY_INDEX,
  KVERT_WEEKLY_URL,
  emptyKvert,
  mergeKvertSnapshots,
  parseKvertDailyIndex,
  parseKvertDailyMessage,
  parseKvertWeeklyHtml,
  type KvertSnapshot,
} from "./kvert";

const UA =
  "SES-Japan-Kamchatka-Monitor/0.1 (observational; +https://github.com/SunWolf77/japan-kamchatka-monitor)";

let mem: { at: number; snap: KvertSnapshot } | null = null;
const CACHE_MS = 30 * 60 * 1000;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": UA },
    cache: "no-store",
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) throw new Error(`KVERT ${res.status} (${url})`);
  return res.text();
}

export const fetchKvertAlerts = createServerFn({ method: "GET" }).handler(
  async (): Promise<KvertSnapshot> => {
    if (mem && Date.now() - mem.at < CACHE_MS) return mem.snap;
    let daily: KvertSnapshot | null = null;
    let weekly: KvertSnapshot | null = null;
    let err: string | undefined;

    try {
      const indexHtml = await fetchText(KVERT_DAILY_INDEX);
      const index = parseKvertDailyIndex(indexHtml);
      if (index[0]) {
        const body = await fetchText(index[0].url);
        daily = parseKvertDailyMessage(body, index[0].id);
      }
    } catch (e) {
      err = e instanceof Error ? e.message : "KVERT daily fetch failed";
    }

    try {
      const weeklyHtml = await fetchText(KVERT_WEEKLY_URL);
      weekly = parseKvertWeeklyHtml(weeklyHtml);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "KVERT weekly fetch failed";
      err = err ? `${err}; ${msg}` : msg;
    }

    const snap = mergeKvertSnapshots(daily, weekly);
    if (err && snap.elevated.length === 0 && snap.all.length === 0) {
      return emptyKvert(err);
    }
    if (err) snap.error = err;
    mem = { at: Date.now(), snap };
    return snap;
  },
);
