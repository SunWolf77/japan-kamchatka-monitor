/**
 * Tomsk Schumann resonance feeds
 * ------------------------------
 * Primary numeric: ResonanceOne Activity Index (Tomsk-attributed)
 *   https://resonanceone.app/api/now
 * Chart imagery: SOSRFF TSU /new/ directory (sch.png is 404 in 2026)
 *   https://sosrff.tsu.ru/new/sra.jpg  (Schumann amplitude)
 *   https://sosrff.tsu.ru/new/fc_fsr1.jpg … fc_fsr4.jpg
 *
 * Client DNS to sosrff.tsu.ru often fails (esp. AU ISPs / .ru blocks).
 * Charts are served via same-origin proxy: /api/tomsk?file=…
 */

export const SCHUMANN_API_URL = "https://resonanceone.app/api/now";
export const TOMSK_BASE = "https://sosrff.tsu.ru/new";
export const TOMSK_HOME = "https://sosrff.tsu.ru/";
export const RESONANCEONE_HOME =
  "https://resonanceone.app/schumann-resonance-today";

/** Allowlisted SOSRFF chart filenames (proxy + UI). */
export const TOMSK_FILES = [
  "sra.jpg",
  "fc_fsr1.jpg",
  "fc_fsr2.jpg",
  "srq.jpg",
  "srf.jpg",
  "mag.jpg",
] as const;

export type TomskFile = (typeof TOMSK_FILES)[number];

export function isAllowedTomskFile(file: string): file is TomskFile {
  return (TOMSK_FILES as readonly string[]).includes(file);
}

export function tomskUpstreamUrl(file: TomskFile | string): string {
  const name = file.replace(/[^a-z0-9_.-]/gi, "");
  return `${TOMSK_BASE}/${name}`;
}

/** Same-origin proxy URL — works when browser cannot resolve sosrff.tsu.ru */
export function tomskProxyUrl(file: TomskFile | string): string {
  return `/api/tomsk?file=${encodeURIComponent(file)}`;
}

/** Live chart assets — proxied for client display. */
export const TOMSK_CHARTS = {
  amplitude: tomskProxyUrl("sra.jpg"),
  spectrogram1: tomskProxyUrl("fc_fsr1.jpg"),
  spectrogram2: tomskProxyUrl("fc_fsr2.jpg"),
  quality: tomskProxyUrl("srq.jpg"),
  frequency: tomskProxyUrl("srf.jpg"),
  magnetic: tomskProxyUrl("mag.jpg"),
  /** Origin (may fail DNS in browser) */
  amplitudeOrigin: tomskUpstreamUrl("sra.jpg"),
  spectrogram1Origin: tomskUpstreamUrl("fc_fsr1.jpg"),
  home: TOMSK_HOME,
  resonanceOne: RESONANCEONE_HOME,
} as const;

export type TomskOriginStatus = "ok" | "down" | "unknown";

export type SchumannSnapshot = {
  activityIndex: number;
  activityLabel: string;
  schumannIndex: number;
  frequencyHz: number;
  kpIndex: number;
  kpLabel: string;
  solarFlareClass: string;
  geomagneticStatus: string;
  summary: string;
  dataSource: string;
  updatedAt: string | null;
  /** SUPT-Dashboard-style factor: clip(index/50, 0.5, 2) */
  schumannFactor: number;
  charts: typeof TOMSK_CHARTS;
  sourceUrl: string;
  /** Server-side probe of sosrff.tsu.ru (not browser DNS) */
  tomskOrigin: TomskOriginStatus;
  tomskNote?: string;
  error?: string;
};

export function emptySchumann(error?: string): SchumannSnapshot {
  return {
    activityIndex: 0,
    activityLabel: "unknown",
    schumannIndex: 0,
    frequencyHz: 7.83,
    kpIndex: 0,
    kpLabel: "unknown",
    solarFlareClass: "—",
    geomagneticStatus: "unknown",
    summary: error ?? "Schumann feed unavailable",
    dataSource: "none",
    updatedAt: null,
    schumannFactor: 1,
    charts: TOMSK_CHARTS,
    sourceUrl: SCHUMANN_API_URL,
    tomskOrigin: "unknown",
    tomskNote:
      "Charts load via app proxy. Direct sosrff.tsu.ru links may fail DNS on some networks.",
    error,
  };
}

export function parseSchumannJson(
  data: unknown,
  origin: TomskOriginStatus = "unknown",
): SchumannSnapshot {
  if (!data || typeof data !== "object") {
    return emptySchumann("Invalid Schumann payload");
  }
  const d = data as Record<string, unknown>;
  const schumannIndex = Number(d.schumann_index ?? 0);
  const activityIndex = Number(d.activity_index ?? 0);
  const schumannFactor = Math.max(
    0.5,
    Math.min(2, (Number.isFinite(schumannIndex) ? schumannIndex : 20) / 50),
  );

  return {
    activityIndex: Number.isFinite(activityIndex) ? activityIndex : 0,
    activityLabel: String(d.activity_index_label ?? "—"),
    schumannIndex: Number.isFinite(schumannIndex) ? schumannIndex : 0,
    frequencyHz: Number(d.schumann_frequency_hz ?? 7.83) || 7.83,
    kpIndex: Number(d.kp_index ?? 0) || 0,
    kpLabel: String(d.kp_label ?? "—"),
    solarFlareClass: String(d.solar_flare_class ?? "—"),
    geomagneticStatus: String(d.geomagnetic_status ?? "—"),
    summary: String(d.summary ?? ""),
    dataSource: String(d.data_source ?? "tomsk"),
    updatedAt: d.updated_at != null ? String(d.updated_at) : null,
    schumannFactor,
    charts: TOMSK_CHARTS,
    sourceUrl: SCHUMANN_API_URL,
    tomskOrigin: origin,
    tomskNote:
      origin === "down"
        ? "SOSRFF origin unreachable from server — proxy charts may fail; index still from ResonanceOne."
        : "Charts via same-origin proxy (browser DNS to tsu.ru often blocked). Numbers from ResonanceOne.",
  };
}

export function schumannTone(
  index: number,
): "muted" | "accent" | "warn" | "critical" {
  if (index >= 80) return "critical";
  if (index >= 60) return "warn";
  if (index >= 40) return "accent";
  return "muted";
}
