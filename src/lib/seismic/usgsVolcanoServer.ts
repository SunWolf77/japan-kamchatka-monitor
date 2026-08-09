import { createServerFn } from "@tanstack/react-start";
import {
  USGS_ELEVATED_URL,
  USGS_VSC_ELEVATED_URL,
  buildUsgsVolcanoSnapshot,
  emptyUsgsVolcano,
  parseHansElevated,
  parseVscElevated,
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

export const fetchUsgsVolcanoAlerts = createServerFn({ method: "GET" }).handler(
  async (): Promise<UsgsVolcanoSnapshot> => {
    if (mem && Date.now() - mem.at < CACHE_MS) return mem.snap;
    try {
      try {
        const raw = await fetchJson(USGS_VSC_ELEVATED_URL);
        const snap = buildUsgsVolcanoSnapshot(parseVscElevated(raw), {
          sourceUrl: USGS_VSC_ELEVATED_URL,
        });
        mem = { at: Date.now(), snap };
        return snap;
      } catch {
        /* fall through */
      }
      const raw = await fetchJson(USGS_ELEVATED_URL);
      const snap = buildUsgsVolcanoSnapshot(parseHansElevated(raw), {
        sourceUrl: USGS_ELEVATED_URL,
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
