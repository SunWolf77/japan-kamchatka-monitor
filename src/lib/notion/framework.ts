/**
 * Curated Notion library index — SUPT / SolWatch operational pages
 * discovered in SunWolf workspace (read-only pointers for the monitor).
 */

export type FrameworkDoc = {
  id: string;
  title: string;
  href: string;
  group: "ops" | "theory" | "nodes" | "archive";
  note: string;
};

export const NOTION_FRAMEWORK: FrameworkDoc[] = [
  {
    id: "sop",
    title: "SUPT SolWatch S.O.P",
    href: "https://app.notion.com/p/2298f11f547a80bea4d3dd3f3f9ea931",
    group: "ops",
    note: "Node methodology · seismic + solar + proxy harmonic cycle",
  },
  {
    id: "ops-fw",
    title: "SUPT Integrated Operations Framework",
    href: "https://app.notion.com/p/fdfd8a5433eb485baf860d14f191eb0c",
    group: "ops",
    note: "Analysis cycle · NATURAL / AMPLIFIED / NON-NATURAL gate",
  },
  {
    id: "hub",
    title: "SolWatch Project Hub",
    href: "https://app.notion.com/p/2268f11f547a809199c3eba83ec90c6f",
    group: "ops",
    note: "Deployment hub · outreach + node schematic",
  },
  {
    id: "hldb",
    title: "SUPT Harmonic Learning Database",
    href: "https://app.notion.com/p/2258f11f547a8096b2bbe45f94e57bbc",
    group: "nodes",
    note: "Epoch table · Campi crack · Tonga–Kermadec chain events",
  },
  {
    id: "diag-wf",
    title: "SUPT SolWatch Diagnostic Workflow",
    href: "https://app.notion.com/p/2368f11f547a80de9495ff07556ccef7",
    group: "ops",
    note: "Layered seismic + harmonic diagnostic steps",
  },
  {
    id: "framework",
    title: "SUPT Framework (Sheppard)",
    href: "https://app.notion.com/p/2478f11f547a8025a7a1c179ce0db86d",
    group: "theory",
    note: "Core theory page · proxy measurement",
  },
  {
    id: "resonance-quakes",
    title: "Resonance Quakes paper",
    href: "https://app.notion.com/p/2698f11f547a80ff8be3f8c1b1caf3c2",
    group: "theory",
    note: "Phantom seismic events · energy-field oscillations",
  },
  {
    id: "pacific-node",
    title: "Submarine Volcano Pacific Node",
    href: "https://app.notion.com/p/2278f11f547a807fb0ced93d02674bc0",
    group: "nodes",
    note: "Pacific submarine volcano watch notes",
  },
  {
    id: "rof",
    title: "Ring of Fire Alert",
    href: "https://app.notion.com/p/2388f11f547a8053b6c7c1384868238d",
    group: "archive",
    note: "Arc-wide alert archive",
  },
  {
    id: "whitepaper",
    title: "SolWatch White Paper",
    href: "https://app.notion.com/p/21f8f11f547a80a3b035e066622b5a04",
    group: "theory",
    note: "Campi · Iceland · Tonga use cases",
  },
];

export const NOTION_LIBRARY_HOME =
  "https://app.notion.com/library/recents?space=supt";
