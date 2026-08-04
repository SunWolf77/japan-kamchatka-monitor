import type { FocusNode, FocusNodeId } from "./types";

/**
 * Sun-Earth-Sentinel focus nodes — Japan board (SES #3).
 *
 *  - japan     → JMA Bosai exclusive (dense domestic catalog + shindo)
 *  - kamchatka → USGS exclusive (Kamchatka / Kurils / Okhotsk slab)
 *
 * SES dragon ids: japan / kamchatka (see ses-bridge.ts, publishedMonitors).
 * Tsunami watch is first-class on this board (JMA VTSE + Pacific M≥6).
 */
export const FOCUS_NODES: Record<FocusNodeId, FocusNode> = {
  japan: {
    id: "japan",
    name: "Japan Arc",
    code: "JP",
    networkOrder: 3,
    network: "sun-earth-sentinel",
    description:
      "Japanese archipelago — Honshu, Hokkaido, Kyushu, Nansei / Tokara. JMA Bosai is the exclusive domestic authority (Mj + shindo). USGS under-samples local microseismicity — no dual-read inside this box.",
    region: "Japan · Nansei · Izu–Bonin corridor",
    provider: "jma",
    fallbackProvider: "usgs",
    bbox: {
      minLat: 24.0,
      maxLat: 46.5,
      minLon: 122.0,
      maxLon: 154.0,
    },
    center: { lat: 36.5, lon: 138.0 },
    mapPad: 1.5,
    mapView: {
      minLat: 30.0,
      maxLat: 42.0,
      minLon: 128.0,
      maxLon: 146.0,
    },
    volcano: {
      name: "Japan volcanic arc",
      type: "Subduction arc / caldera chain",
      statusNote:
        "JMA monitors ~50 active volcanoes (Sakurajima, Asama, Aso, Fuji, Tokara islands, etc.). Levels 1–5. Submarine Tokara / Izu–Bonin nodes are SolWatch Pacific lattice anchors.",
      officialMapUrl: "https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=vol&lang=en",
    },
    depthRangeKm: { shallow: 40, deep: 150 },
    tsunamiWatch: true,
  },
  kamchatka: {
    id: "kamchatka",
    name: "Kamchatka–Kurils",
    code: "KM",
    networkOrder: 3,
    network: "sun-earth-sentinel",
    description:
      "Kamchatka Peninsula, Kuril Islands, and western Aleutian approach — Pacific plate subduction under Okhotsk / North American plates. USGS global FDSN is the exclusive authority (KVERT for volcanic status links). High tsunami source potential.",
    region: "Russian Far East · NW Pacific",
    provider: "usgs",
    fallbackProvider: "usgs",
    bbox: {
      minLat: 42.0,
      maxLat: 62.0,
      minLon: 145.0,
      maxLon: 175.0,
    },
    center: { lat: 53.0, lon: 158.5 },
    mapPad: 1.0,
    mapView: {
      minLat: 48.0,
      maxLat: 58.0,
      minLon: 152.0,
      maxLon: 165.0,
    },
    volcano: {
      name: "Kamchatka volcanic arc",
      type: "Continental arc / stratovolcano chain",
      statusNote:
        "KVERT / IVS monitors Bezymianny, Shiveluch, Klyuchevskoy, Karymsky, Ebeko, and others. Frequent ash advisories for aviation. Coupled to Japan via NW Pacific tsunami corridors.",
      officialMapUrl: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    },
    depthRangeKm: { shallow: 70, deep: 300 },
    tsunamiWatch: true,
  },
};

export const DEFAULT_FOCUS_NODE: FocusNodeId = "japan";

export function getFocusNode(id: FocusNodeId | string): FocusNode {
  if (id in FOCUS_NODES) return FOCUS_NODES[id as FocusNodeId];
  return FOCUS_NODES.japan;
}

export function listFocusNodes(): FocusNode[] {
  return Object.values(FOCUS_NODES).sort((a, b) => {
    if (a.networkOrder !== b.networkOrder) return a.networkOrder - b.networkOrder;
    return a.code.localeCompare(b.code);
  });
}
