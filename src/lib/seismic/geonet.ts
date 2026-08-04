/**
 * GeoNet Volcanic Alert Level (VAL) — NZ / Kermadec arc
 * https://api.geonet.org.nz/volcano/val
 *
 * Direct Tonga–Kermadec link: volcanoID `kermadecislands`.
 * GeoNet does not cover Hunga Tonga itself (outside NZ mandate) —
 * Kermadec Islands is the official GeoNet box on this arc.
 */

export const GEONET_VAL_URL = "https://api.geonet.org.nz/volcano/val";

export type GeonetVolcano = {
  id: string;
  title: string;
  /** Aviation colour code: Green | Yellow | Orange | Red */
  acc: string;
  /** Volcanic Alert Level 0–5 */
  level: number;
  activity: string;
  hazards: string;
  lat: number;
  lon: number;
  /** Highlight for Tonga–Kermadec node */
  isKermadecArc: boolean;
};

export type GeonetValSnapshot = {
  volcanoes: GeonetVolcano[];
  /** Primary for this SES node */
  kermadec: GeonetVolcano | null;
  elevated: GeonetVolcano[];
  fetchedAt: number;
  sourceUrl: string;
  error?: string;
};

const KERMADEC_IDS = new Set(["kermadecislands"]);
/** Regional NZ arc context often watched with TK node */
const ARC_CONTEXT_IDS = new Set([
  "kermadecislands",
  "whiteisland",
  "ruapehu",
  "tongariro",
  "ngauruhoe",
  "taupo",
]);

export function emptyGeonet(error?: string): GeonetValSnapshot {
  return {
    volcanoes: [],
    kermadec: null,
    elevated: [],
    fetchedAt: Date.now(),
    sourceUrl: GEONET_VAL_URL,
    error,
  };
}

export function parseGeonetVal(data: unknown): GeonetValSnapshot {
  if (!data || typeof data !== "object") return emptyGeonet("Invalid GeoNet payload");
  const fc = data as { features?: unknown[] };
  const features = Array.isArray(fc.features) ? fc.features : [];
  const volcanoes: GeonetVolcano[] = [];

  for (const f of features) {
    if (!f || typeof f !== "object") continue;
    const feat = f as {
      geometry?: { coordinates?: number[] };
      properties?: Record<string, unknown>;
    };
    const p = feat.properties ?? {};
    const coords = feat.geometry?.coordinates ?? [];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const id = String(p.volcanoID ?? p.volcanoId ?? "").toLowerCase();
    if (!id) continue;
    volcanoes.push({
      id,
      title: String(p.volcanoTitle ?? p.title ?? id),
      acc: String(p.acc ?? "Green"),
      level: Number(p.level ?? 0) || 0,
      activity: String(p.activity ?? ""),
      hazards: String(p.hazards ?? ""),
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      isKermadecArc: KERMADEC_IDS.has(id) || ARC_CONTEXT_IDS.has(id),
    });
  }

  const kermadec =
    volcanoes.find((v) => v.id === "kermadecislands") ?? null;
  const elevated = volcanoes
    .filter((v) => v.level >= 1 || v.acc.toLowerCase() !== "green")
    .sort((a, b) => b.level - a.level);

  return {
    volcanoes,
    kermadec,
    elevated,
    fetchedAt: Date.now(),
    sourceUrl: GEONET_VAL_URL,
  };
}

export function accTone(
  acc: string,
): "muted" | "accent" | "warn" | "critical" {
  const a = acc.toLowerCase();
  if (a === "red") return "critical";
  if (a === "orange") return "critical";
  if (a === "yellow") return "warn";
  return "muted";
}
