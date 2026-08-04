/**
 * Japan + Kamchatka volcano watch registry.
 * Operational status links to JMA Bosai / KVERT; static watchlist for map pins.
 */

import type { FocusNodeId } from "./types";

export type VolcanoAlertLevel = 0 | 1 | 2 | 3 | 4 | 5 | "unknown";

export type WatchedVolcano = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  elevM?: number;
  /** Static baseline note — not a live alert. */
  note: string;
  authority: "jma" | "kvert" | "avo";
  href: string;
  tags: string[];
};

export const JAPAN_VOLCANOES: WatchedVolcano[] = [
  {
    id: "sakurajima",
    name: "Sakurajima",
    region: "Kyushu",
    lat: 31.59,
    lon: 130.66,
    elevM: 1117,
    note: "Frequent vulcanian explosions; JMA regularly issues crater-proximal warnings.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/31.59/130.66/&elem=vol&lang=en",
    tags: ["andesitic", "frequent"],
  },
  {
    id: "aso",
    name: "Aso",
    region: "Kyushu",
    lat: 32.88,
    lon: 131.1,
    elevM: 1592,
    note: "Caldera system; Nakadake crater gas / ash episodes.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/32.88/131.1/&elem=vol&lang=en",
    tags: ["caldera"],
  },
  {
    id: "asama",
    name: "Asama",
    region: "Honshu",
    lat: 36.4,
    lon: 138.52,
    elevM: 2568,
    note: "Historic explosive eruptions; closely watched by JMA.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/36.4/138.52/&elem=vol&lang=en",
    tags: ["stratovolcano"],
  },
  {
    id: "fuji",
    name: "Fuji",
    region: "Honshu",
    lat: 35.36,
    lon: 138.73,
    elevM: 3776,
    note: "Dormant stratovolcano; long repose; high societal impact if reactivated.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/35.36/138.73/&elem=vol&lang=en",
    tags: ["iconic", "high impact"],
  },
  {
    id: "tokara-suwanose",
    name: "Suwanosejima",
    region: "Tokara / Nansei",
    lat: 29.64,
    lon: 129.72,
    elevM: 799,
    note: "Tokara submarine/island node — SolWatch Pacific lattice fulcrum.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#9/29.64/129.72/&elem=vol&lang=en",
    tags: ["Tokara", "SolWatch", "submarine corridor"],
  },
  {
    id: "ioto",
    name: "Ioto (Iwo Jima)",
    region: "Izu–Bonin",
    lat: 24.75,
    lon: 141.29,
    elevM: 169,
    note: "Rapid uplift episodes; submarine/island hydrothermal system.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#9/24.75/141.29/&elem=vol&lang=en",
    tags: ["uplift", "Bonin"],
  },
  {
    id: "kusatsu-shirane",
    name: "Kusatsu–Shirane",
    region: "Honshu",
    lat: 36.62,
    lon: 138.54,
    elevM: 2160,
    note: "Phreatic hazard; tourist-proximal crater lakes.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/36.62/138.54/&elem=vol&lang=en",
    tags: ["phreatic"],
  },
  {
    id: "kirishima",
    name: "Kirishima (Shinmoedake)",
    region: "Kyushu",
    lat: 31.93,
    lon: 130.86,
    elevM: 1421,
    note: "2011 / 2018 eruptive sequences; ash to aviation corridors.",
    authority: "jma",
    href: "https://www.jma.go.jp/bosai/map.html#10/31.93/130.86/&elem=vol&lang=en",
    tags: ["ash"],
  },
];

export const KAMCHATKA_VOLCANOES: WatchedVolcano[] = [
  {
    id: "shiveluch",
    name: "Shiveluch",
    region: "N Kamchatka",
    lat: 56.65,
    lon: 161.36,
    elevM: 3283,
    note: "Highly active dome / collapse system; frequent ash plumes.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["very active", "ash aviation"],
  },
  {
    id: "klyuchevskoy",
    name: "Klyuchevskoy",
    region: "N Kamchatka",
    lat: 56.06,
    lon: 160.64,
    elevM: 4754,
    note: "Tallest active volcano in Eurasia; frequent Strombolian–effusive activity.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["iconic", "ash aviation"],
  },
  {
    id: "bezymianny",
    name: "Bezymianny",
    region: "N Kamchatka",
    lat: 55.97,
    lon: 160.59,
    elevM: 2882,
    note: "1956 directed blast analogue; recurrent dome growth / collapse.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["dome", "blast"],
  },
  {
    id: "karymsky",
    name: "Karymsky",
    region: "E Kamchatka",
    lat: 54.05,
    lon: 159.45,
    elevM: 1536,
    note: "Near-continuous strombolian activity for decades.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["persistent"],
  },
  {
    id: "ebeko",
    name: "Ebeko",
    region: "Paramushir · Kurils",
    lat: 50.69,
    lon: 156.01,
    elevM: 1156,
    note: "Frequent ash emissions affecting Severo-Kurilsk.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["Kurils", "ash"],
  },
  {
    id: "chikurachki",
    name: "Chikurachki",
    region: "Paramushir · Kurils",
    lat: 50.32,
    lon: 155.46,
    elevM: 1816,
    note: "Explosive basaltic–andesite eruptions; ash to aviation.",
    authority: "kvert",
    href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
    tags: ["Kurils"],
  },
];

export function volcanoesForNode(nodeId: FocusNodeId): WatchedVolcano[] {
  return nodeId === "kamchatka" ? KAMCHATKA_VOLCANOES : JAPAN_VOLCANOES;
}

export function volcanoAuthorityLabel(nodeId: FocusNodeId): string {
  return nodeId === "kamchatka" ? "KVERT / IVS (linked)" : "JMA volcano warnings";
}
