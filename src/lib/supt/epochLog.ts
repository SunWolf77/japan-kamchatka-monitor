/**
 * SUPT Epoch Log — seeded knowledge + live learning
 * -------------------------------------------------
 * Seeds: Harmonic Learning Database (Notion) + Pacific NODE_07-05 + CF/TK nodes.
 * Learns: when live Continuum / swarm / Schumann cross thresholds, append an
 * epoch with signature + update running priors (AI memory in localStorage).
 *
 * Not a forecast engine — observational pattern memory for detective work.
 */

import type { FocusNodeId } from "@/lib/seismic/types";
import type { ContinuumReport } from "@/lib/supt/continuum";
import type { SwarmAnalysis } from "@/lib/seismic/types";
import type { SchumannSnapshot } from "@/lib/supt/schumann";

export type EpochSource = "seed" | "learned" | "manual";

export type EpochEntry = {
  id: string;
  /** Inclusive ISO date range or single day */
  period: string;
  title: string;
  signature: string;
  trigger: string;
  nodes: string[];
  notes: string;
  source: EpochSource;
  /** Optional live metrics at learn time */
  metrics?: {
    eii?: number;
    rpam?: string;
    cci?: number;
    schumannIndex?: number;
    rate6h?: number;
    maxMag?: number;
    shallowFraction?: number;
    nodeId?: FocusNodeId;
  };
  createdAt: number;
  /** How many times a similar live pattern re-fired */
  hits: number;
};

export type EpochMemory = {
  version: 1;
  priors: {
    /** Running mean EII when RPAM ≥ ELEVATED */
    meanElevatedEii: number;
    elevatedSamples: number;
    meanSchumannWhenElevated: number;
    schumannSamples: number;
    meanShallowWhenActive: number;
    activeSamples: number;
    /** Learned association: high Schumann + high shallow → EII boost observed */
    schumannShallowCoupling: number;
  };
  learned: EpochEntry[];
  lastLearnAt: number | null;
};

const STORAGE_KEY = "ses-jp-epoch-log-v1";

/** Harmonic Learning Database + Pacific node seeds (Notion). */
export const SEED_EPOCHS: EpochEntry[] = [
  {
    id: "seed-2024-07-indonesia-png",
    period: "2024-07-07 → 07-11",
    title: "Indonesia–PNG Quake Bloom",
    signature: "High-pressure tension dome collapse · west Pacific redistribution",
    trigger: "Moon–Jupiter 180°",
    nodes: ["PNG–Fiji", "Indonesia Arc"],
    notes: "Prelude resonant epoch (Jul–Dec 2024 audit).",
    source: "seed",
    createdAt: Date.parse("2024-07-07T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2024-08-tonga-kermadec",
    period: "2024-08-18 → 08-22",
    title: "Tonga–Kermadec Chain Event",
    signature: "Deep trench slip · inner-core vibratory resonance noted",
    trigger: "Mercury–Saturn square",
    nodes: ["tonga-kermadec", "kermadec-islands"],
    notes: "Harmonic Learning DB · primary SES node pathway.",
    source: "seed",
    createdAt: Date.parse("2024-08-18T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2024-10-italy-turkey",
    period: "2024-10-26 → 10-30",
    title: "Italy + Turkey Tension Bloom",
    signature: "Magma pulse under hydrothermal layers · Vesuvius micro-activity",
    trigger: "Full Moon–Pluto 90°",
    nodes: ["campi-flegrei", "Mediterranean"],
    notes: "Mediterranean fragile-proxy lens prelude.",
    source: "seed",
    createdAt: Date.parse("2024-10-26T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2025-06-campi-crack",
    period: "2025-06-25 → 06-30",
    title: "Ring Activation + Campi Crack",
    signature: "Solar breathing arc · Campi Flegrei stress breach + global sync",
    trigger: "Moon–Earth–Sun 60°",
    nodes: ["campi-flegrei", "Ring of Fire"],
    notes: "Harmonic Learning DB · Mediterranean hydrothermal–seismic pingbacks.",
    source: "seed",
    createdAt: Date.parse("2025-06-25T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2025-07-pacific-node",
    period: "2025-07-05",
    title: "Pacific Submarine Volcano Node 07-05",
    signature: "South Japan ψ₈ volcanic buildup 10–20 km · Pacific lattice friction",
    trigger: "Proxy observation · Ring of Fire corridor",
    nodes: ["south-japan-pacific", "tokara", "tonga-kermadec"],
    notes:
      "SUNWOLF_VOLCANO_PACIFICNODE_07-05. Resonance pathway to Tonga 2022. Awaiting cascade or discharge.",
    source: "seed",
    createdAt: Date.parse("2025-07-05T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2025-07-tokara",
    period: "2025-07",
    title: "Tokara Submarine Fulcrum",
    signature: "Japan arc submarine swarm · SolWatch harmonic fulcrum",
    trigger: "SolWatch SitRep / rupture forecast window",
    nodes: ["tokara", "south-japan-pacific"],
    notes: "Tokara as song’s fulcrum — submarine release & regional energy reset language.",
    source: "seed",
    createdAt: Date.parse("2025-07-08T00:00:00Z"),
    hits: 0,
  },
  {
    id: "seed-2022-hunga",
    period: "2022-01",
    title: "Hunga Tonga–Hunga Haʻapai Activation",
    signature: "Caldera eruption · Pacific ψ₈ pathway reference",
    trigger: "Major VEI-scale submarine eruption",
    nodes: ["hunga-tonga", "tonga-kermadec"],
    notes: "Reference activation for ψ-Replay loops from Pacific NODE_07-05.",
    source: "seed",
    createdAt: Date.parse("2022-01-15T00:00:00Z"),
    hits: 0,
  },
];

const DEFAULT_MEMORY: EpochMemory = {
  version: 1,
  priors: {
    meanElevatedEii: 0.65,
    elevatedSamples: 0,
    meanSchumannWhenElevated: 50,
    schumannSamples: 0,
    meanShallowWhenActive: 0.5,
    activeSamples: 0,
    schumannShallowCoupling: 0,
  },
  learned: [],
  lastLearnAt: null,
};

function loadMemory(): EpochMemory {
  if (typeof window === "undefined") return { ...DEFAULT_MEMORY, priors: { ...DEFAULT_MEMORY.priors } };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MEMORY, priors: { ...DEFAULT_MEMORY.priors } };
    const parsed = JSON.parse(raw) as EpochMemory;
    if (parsed?.version !== 1) return { ...DEFAULT_MEMORY, priors: { ...DEFAULT_MEMORY.priors } };
    return {
      ...DEFAULT_MEMORY,
      ...parsed,
      priors: { ...DEFAULT_MEMORY.priors, ...parsed.priors },
      learned: Array.isArray(parsed.learned) ? parsed.learned : [],
    };
  } catch {
    return { ...DEFAULT_MEMORY, priors: { ...DEFAULT_MEMORY.priors } };
  }
}

function saveMemory(mem: EpochMemory): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch {
    /* quota */
  }
}

export function getEpochMemory(): EpochMemory {
  return loadMemory();
}

export function listEpochs(mem?: EpochMemory): EpochEntry[] {
  const m = mem ?? loadMemory();
  return [...SEED_EPOCHS, ...m.learned].sort((a, b) => b.createdAt - a.createdAt);
}

function runningMean(prev: number, n: number, x: number): { mean: number; n: number } {
  const nn = n + 1;
  return { mean: prev + (x - prev) / nn, n: nn };
}

function similarLearned(
  learned: EpochEntry[],
  nodeId: FocusNodeId,
  rpam: string,
  withinMs = 6 * 3_600_000,
  now = Date.now(),
): EpochEntry | undefined {
  return learned.find(
    (e) =>
      e.metrics?.nodeId === nodeId &&
      e.metrics?.rpam === rpam &&
      now - e.createdAt < withinMs,
  );
}

/**
 * Observe live state: update priors + open a learned epoch when phase elevates
 * or Schumann×shallow coupling is strong.
 */
export function learnFromObservation(input: {
  nodeId: FocusNodeId;
  continuum: ContinuumReport;
  swarm: SwarmAnalysis;
  schumann?: SchumannSnapshot | null;
  now?: number;
}): { memory: EpochMemory; newEpoch: EpochEntry | null; updated: boolean } {
  const now = input.now ?? Date.now();
  const mem = loadMemory();
  const { continuum: C, swarm, nodeId, schumann } = input;
  let updated = false;
  let newEpoch: EpochEntry | null = null;

  // --- priors ---
  if (C.rpam === "ELEVATED" || C.rpam === "ACTIVE") {
    const r = runningMean(mem.priors.meanElevatedEii, mem.priors.elevatedSamples, C.eii);
    mem.priors.meanElevatedEii = r.mean;
    mem.priors.elevatedSamples = r.n;
    if (schumann && !schumann.error && schumann.schumannIndex > 0) {
      const s = runningMean(
        mem.priors.meanSchumannWhenElevated,
        mem.priors.schumannSamples,
        schumann.schumannIndex,
      );
      mem.priors.meanSchumannWhenElevated = s.mean;
      mem.priors.schumannSamples = s.n;
    }
    updated = true;
  }
  if (C.rpam === "ACTIVE") {
    const r = runningMean(
      mem.priors.meanShallowWhenActive,
      mem.priors.activeSamples,
      C.shallowRatio,
    );
    mem.priors.meanShallowWhenActive = r.mean;
    mem.priors.activeSamples = r.n;
    updated = true;
  }

  // Schumann × shallow coupling score (0–1 observational)
  if (schumann && schumann.schumannIndex >= 55 && C.shallowRatio >= 0.4) {
    const coup = Math.min(
      1,
      (schumann.schumannIndex / 100) * 0.5 + C.shallowRatio * 0.5,
    );
    mem.priors.schumannShallowCoupling =
      mem.priors.schumannShallowCoupling * 0.85 + coup * 0.15;
    updated = true;
  }

  // --- epoch open conditions ---
  const shouldOpen =
    C.rpam === "ACTIVE" ||
    (C.rpam === "ELEVATED" && C.eii >= 0.7) ||
    (schumann != null &&
      schumann.schumannIndex >= 70 &&
      C.shallowRatio >= 0.45 &&
      swarm.rate6h >= 10) ||
    (swarm.active != null && swarm.active.maxMag >= 4.0 && swarm.rate1h >= 5);

  if (shouldOpen) {
    const existing = similarLearned(mem.learned, nodeId, C.rpam, 6 * 3_600_000, now);
    if (existing) {
      existing.hits += 1;
      existing.metrics = {
        eii: C.eii,
        rpam: C.rpam,
        cci: C.cci,
        schumannIndex: C.schumannIndex,
        rate6h: swarm.rate6h,
        maxMag: swarm.maxMagWindow,
        shallowFraction: C.shallowRatio,
        nodeId,
      };
      existing.notes = `Updated ${new Date(now).toISOString().slice(0, 16)}Z · hits=${existing.hits}. ${C.diagnostic.slice(0, 180)}`;
      updated = true;
    } else {
      const day = new Date(now).toISOString().slice(0, 10);
      const title =
        C.rpam === "ACTIVE"
          ? `${nodeId} ACTIVE pulse · EII ${C.eii.toFixed(2)}`
          : schumann && schumann.schumannIndex >= 70
            ? `${nodeId} Schumann×swarm coupling · SR ${schumann.schumannIndex}`
            : `${nodeId} ELEVATED epoch · EII ${C.eii.toFixed(2)}`;

      newEpoch = {
        id: `learn-${nodeId}-${now}`,
        period: day,
        title,
        signature: [
          `EII ${C.eii.toFixed(3)} (base ${C.eiiBase.toFixed(3)})`,
          `SR ${C.schumannIndex}×${C.schumannFactor.toFixed(2)}`,
          `shallow ${(C.shallowRatio * 100).toFixed(0)}%`,
          `rate6h ${swarm.rate6h}`,
          `max M${swarm.maxMagWindow.toFixed(1)}`,
        ].join(" · "),
        trigger: C.rpamLabel,
        nodes: [nodeId, ...(nodeId === "kamchatka" ? ["kurils", "okhotsk"] : nodeId === "japan" ? ["tokara", "south-japan-pacific"] : [])],
        notes: C.diagnostic.slice(0, 280),
        source: "learned",
        metrics: {
          eii: C.eii,
          rpam: C.rpam,
          cci: C.cci,
          schumannIndex: C.schumannIndex,
          rate6h: swarm.rate6h,
          maxMag: swarm.maxMagWindow,
          shallowFraction: C.shallowRatio,
          nodeId,
        },
        createdAt: now,
        hits: 1,
      };
      mem.learned = [newEpoch, ...mem.learned].slice(0, 80);
      updated = true;
    }
  }

  if (updated) {
    mem.lastLearnAt = now;
    saveMemory(mem);
  }

  return { memory: mem, newEpoch, updated };
}

export function memoryInsight(mem: EpochMemory): string {
  const p = mem.priors;
  const parts: string[] = [];
  if (p.elevatedSamples > 0) {
    parts.push(
      `Learned elevated EII mean ${p.meanElevatedEii.toFixed(3)} (n=${p.elevatedSamples}).`,
    );
  }
  if (p.schumannSamples > 0) {
    parts.push(
      `When elevated, mean SR index ${p.meanSchumannWhenElevated.toFixed(0)} (n=${p.schumannSamples}).`,
    );
  }
  if (p.activeSamples > 0) {
    parts.push(
      `ACTIVE pulses: mean shallow ${(p.meanShallowWhenActive * 100).toFixed(0)}% (n=${p.activeSamples}).`,
    );
  }
  if (p.schumannShallowCoupling > 0.2) {
    parts.push(
      `Schumann×shallow coupling prior ${p.schumannShallowCoupling.toFixed(2)} (ELF+hydrothermal co-elevation).`,
    );
  }
  if (mem.learned.length) {
    parts.push(`${mem.learned.length} live-learned epoch(s) in memory.`);
  }
  if (!parts.length) {
    return "No live learning yet — priors will update when RPAM elevates or Schumann couples with shallow swarms.";
  }
  return parts.join(" ");
}

/** Portable snapshot for download / backup (seeds + learned + priors). */
export type EpochExportBundle = {
  format: "ses-jp-epoch-log";
  version: 1;
  exportedAt: string;
  nodeHint?: string;
  seeds: EpochEntry[];
  memory: EpochMemory;
  insight: string;
  laicNote: string;
};

export const LAIC_BRIEF = {
  title: "LAIC · Lithosphere–Atmosphere–Ionosphere Coupling",
  summary:
    "Research frame linking crustal stress, atmospheric conductivity, and ionospheric / ELF cavity perturbations. Schumann resonances (~7.8 Hz+) are global lightning-driven cavity modes; local ULF magnetometry is a separate, denser precursor literature. This monitor co-registers Tomsk SR with authority seismic stats as an observational index — not an operational forecast.",
  layers: [
    {
      id: "L",
      name: "Lithosphere",
      role: "Stress, fluid, shallow swarm (GOSSIP/INGV · USGS by node)",
    },
    {
      id: "A",
      name: "Atmosphere",
      role: "Conductivity / fair-weather field; storm noise can swamp SR sensors",
    },
    {
      id: "I",
      name: "Ionosphere / ELF",
      role: "Earth–ionosphere cavity · Schumann modes · space-weather ψₛ (Kp, solar wind)",
    },
  ],
  caveats: [
    "Mainstream seismology does not treat SR amplitude as a standalone predictor.",
    "Tomsk spikes may be local thunderstorms, not global cavity changes.",
    "Use multi-instrument coherence (catalog + Kp + SR + depth fabric) — never a single feed.",
  ],
} as const;

export function buildExportBundle(nodeHint?: string): EpochExportBundle {
  const memory = loadMemory();
  return {
    format: "ses-jp-epoch-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    nodeHint,
    seeds: SEED_EPOCHS,
    memory,
    insight: memoryInsight(memory),
    laicNote: LAIC_BRIEF.summary,
  };
}

export function downloadEpochJson(nodeHint?: string): void {
  if (typeof window === "undefined") return;
  const bundle = buildExportBundle(nodeHint);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = bundle.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `ses-epoch-memory-${stamp}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Spreadsheet-friendly export of seeds + learned epochs (one row per epoch). */
export function buildEpochCsv(nodeHint?: string): string {
  const mem = loadMemory();
  const rows = listEpochs(mem);
  const header = [
    "id",
    "source",
    "period",
    "title",
    "signature",
    "trigger",
    "nodes",
    "hits",
    "eii",
    "rpam",
    "cci",
    "schumannIndex",
    "rate6h",
    "maxMag",
    "shallowFraction",
    "nodeId",
    "createdAt",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const e of rows) {
    lines.push(
      [
        e.id,
        e.source,
        e.period,
        e.title,
        e.signature,
        e.trigger,
        e.nodes.join("|"),
        e.hits,
        e.metrics?.eii ?? "",
        e.metrics?.rpam ?? "",
        e.metrics?.cci ?? "",
        e.metrics?.schumannIndex ?? "",
        e.metrics?.rate6h ?? "",
        e.metrics?.maxMag ?? "",
        e.metrics?.shallowFraction ?? "",
        e.metrics?.nodeId ?? "",
        new Date(e.createdAt).toISOString(),
        e.notes,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  // Trailing meta for Notion paste context
  lines.push("");
  lines.push(
    csvEscape(
      `# ses-jp-epoch-log csv · nodeHint=${nodeHint ?? ""} · elevatedEiiμ=${mem.priors.meanElevatedEii.toFixed(3)} · learned=${mem.learned.length}`,
    ),
  );
  return lines.join("\n");
}

export function downloadEpochCsv(nodeHint?: string): void {
  if (typeof window === "undefined") return;
  const csv = buildEpochCsv(nodeHint);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `ses-epoch-memory-${stamp}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Merge imported learned epochs + priors (does not overwrite seeds). */
export function importEpochJson(raw: string): { ok: true; memory: EpochMemory } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw) as Partial<EpochExportBundle> & { memory?: EpochMemory };
    if (!data || typeof data !== "object") return { ok: false, error: "Invalid JSON" };
    const incoming = data.memory ?? (data as unknown as EpochMemory);
    if (!incoming || incoming.version !== 1) {
      return { ok: false, error: "Unrecognized epoch memory version" };
    }
    const current = loadMemory();
    const byId = new Map<string, EpochEntry>();
    for (const e of current.learned) byId.set(e.id, e);
    for (const e of incoming.learned ?? []) {
      if (!e?.id) continue;
      const prev = byId.get(e.id);
      if (!prev || (e.hits ?? 0) >= (prev.hits ?? 0)) byId.set(e.id, e);
    }
    const merged: EpochMemory = {
      version: 1,
      priors: {
        ...current.priors,
        ...incoming.priors,
        elevatedSamples: Math.max(
          current.priors.elevatedSamples,
          incoming.priors?.elevatedSamples ?? 0,
        ),
        schumannSamples: Math.max(
          current.priors.schumannSamples,
          incoming.priors?.schumannSamples ?? 0,
        ),
        activeSamples: Math.max(
          current.priors.activeSamples,
          incoming.priors?.activeSamples ?? 0,
        ),
      },
      learned: [...byId.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 80),
      lastLearnAt: Math.max(current.lastLearnAt ?? 0, incoming.lastLearnAt ?? 0) || null,
    };
    saveMemory(merged);
    return { ok: true, memory: merged };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}
