/**
 * Pacific submarine / arc node registry
 * ------------------------------------
 * From Notion:
 *  - SUNWOLF SUBMARINE VOLCANO PACIFIC NODE_07-05 (South Japan ψ₈)
 *  - Tokara SitRep / Harmonic Rupture Forecast
 *  - Tonga–Kermadec (SES node #1)
 *  - GeoNet Kermadec Islands VAL
 *  - Harmonic Learning Database epochs
 *
 * Not dual-read with Campi Flegrei INGV authority — Pacific boxes use USGS / GeoNet.
 */

export type PacificNodeId =
  | "tonga-kermadec"
  | "kermadec-islands"
  | "tokara"
  | "south-japan-pacific"
  | "hunga-tonga";

export type PacificNode = {
  id: PacificNodeId;
  name: string;
  role: string;
  region: string;
  center: { lat: number; lon: number };
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  authority: "usgs" | "geonet" | "mixed";
  notionHref?: string;
  notes: string;
  /** Harmonic Learning DB / SUPT tags */
  tags: string[];
};

export const PACIFIC_NODES: PacificNode[] = [
  {
    id: "tonga-kermadec",
    name: "Tonga–Kermadec arc",
    role: "SES focus node #1 · trench / arc seismicity",
    region: "SW Pacific",
    center: { lat: -20.5, lon: -175.4 },
    bbox: { minLat: -26.5, maxLat: -14.0, minLon: -179.5, maxLon: -172.0 },
    authority: "usgs",
    notionHref: "https://app.notion.com/p/2258f11f547a8096b2bbe45f94e57bbc",
    notes:
      "Primary SES dragon node. USGS exclusive. Linked to Tonga 2022 activation pathway in Pacific ψ₈ grid.",
    tags: ["SES", "USGS", "Ring of Fire", "ψ₈"],
  },
  {
    id: "kermadec-islands",
    name: "Kermadec Islands (GeoNet VAL)",
    role: "Official NZ volcanic alert box on TK arc",
    region: "Kermadec · NZ mandate",
    center: { lat: -29.254, lon: -177.914 },
    bbox: { minLat: -32, maxLat: -26, minLon: -180, maxLon: -175 },
    authority: "geonet",
    notionHref: "https://www.geonet.org.nz/volcano",
    notes:
      "GeoNet volcanoID kermadecislands. Direct volcanic status companion for Tonga–Kermadec node (Hunga itself is outside GeoNet).",
    tags: ["GeoNet", "VAL", "subduction volcano"],
  },
  {
    id: "hunga-tonga",
    name: "Hunga Tonga–Hunga Haʻapai",
    role: "2022 caldera eruption · lattice activation reference",
    region: "Tonga",
    center: { lat: -20.536, lon: -175.382 },
    bbox: { minLat: -21.2, maxLat: -19.8, minLon: -176.0, maxLon: -174.8 },
    authority: "usgs",
    notes:
      "Reference activation (2022) cited in Pacific NODE_07-05 as prior resonance pathway. USGS/local for ongoing seismicity.",
    tags: ["2022", "caldera", "ψ₈ pathway"],
  },
  {
    id: "tokara",
    name: "Tokara submarine node",
    role: "Jul 2025 SolWatch fulcrum · Japan arc submarine swarm",
    region: "Nansei / Tokara islands, Japan",
    center: { lat: 29.15, lon: 129.3 },
    bbox: { minLat: 28.5, maxLat: 30.0, minLon: 128.5, maxLon: 130.2 },
    authority: "usgs",
    notionHref: "https://app.notion.com/p/2328f11f547a8095bb78dec8c9788611",
    notes:
      "SUPT SolWatch Tokara SitRep / Harmonic Rupture Forecast — submarine node as ‘song’s fulcrum’ for Japan arc energy.",
    tags: ["Tokara", "SolWatch", "submarine", "JMA context"],
  },
  {
    id: "south-japan-pacific",
    name: "South Japan Pacific ψ₈ node",
    role: "SUNWOLF_VOLCANO_PACIFICNODE_07-05",
    region: "South of Japan · Ring of Fire corridor",
    center: { lat: 30.5, lon: 140.0 },
    bbox: { minLat: 28, maxLat: 34, minLon: 136, maxLon: 144 },
    authority: "usgs",
    notionHref: "https://app.notion.com/p/2278f11f547a807fb0ced93d02674bc0",
    notes:
      "Notion log 2025-07-05: volcanic buildup 10–20 km depth, Pacific-wide sloshing risk language, ψ-Replay from Tonga 2022 onward.",
    tags: ["ψ₈", "Pacific grid", "HOFI", "SunWolf log"],
  },
];

export function getPacificNode(id: PacificNodeId | string): PacificNode | undefined {
  return PACIFIC_NODES.find((n) => n.id === id);
}
