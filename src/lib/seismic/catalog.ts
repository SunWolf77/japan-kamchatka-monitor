/**
 * Safe catalog payload defaults — never let the UI crash on missing provider fields.
 */

import type {
  FocusNodeId,
  QuakeEvent,
  SeismicProviderId,
  SwarmAnalysis,
  SwarmCluster,
  SwarmEventChip,
} from "./types";
import { analyzeSwarmActivity } from "./swarm";

export type WindowKey = "24h" | "48h" | "7d" | "30d" | "ytd";

export type CatalogPayload = {
  events: QuakeEvent[];
  provider: SeismicProviderId;
  fetchedAt: number;
  sourceUrl: string;
  count: number;
  window: { start: string; end: string; key: WindowKey };
  nodeId: FocusNodeId;
  swarm: SwarmAnalysis;
  error?: string;
  /** Exclusive catalog family for this node. */
  authority?: "jma-family" | "usgs-family" | "ingv-family";
  /** Providers tried (same family only). */
  attempted?: SeismicProviderId[];
};

export function emptySwarm(now = Date.now()): SwarmAnalysis {
  // Minimal shell — no 72h empty bins (keeps SSR tiny)
  return {
    clusters: [],
    active: null,
    rate24h: 0,
    rate6h: 0,
    rate1h: 0,
    maxMagWindow: 0,
    meanDepthKm: 0,
    shallowFraction: 0,
    cumulativeEnergy: 0,
    hourlyBins: [],
  };
}

export function emptyCatalog(opts?: {
  nodeId?: FocusNodeId;
  windowKey?: WindowKey;
  provider?: CatalogPayload["provider"];
  error?: string;
}): CatalogPayload {
  const nodeId = opts?.nodeId ?? "japan";
  const windowKey = opts?.windowKey ?? "7d";
  const end = new Date();
  const start =
    windowKey === "ytd"
      ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1))
      : new Date(
          end.getTime() -
            (windowKey === "24h"
              ? 24
              : windowKey === "48h"
                ? 48
                : windowKey === "7d"
                  ? 168
                  : 720) *
              3_600_000,
        );

  return {
    events: [],
    provider: opts?.provider ?? (nodeId === "japan" ? "jma" : "usgs"),
    fetchedAt: Date.now(),
    sourceUrl: "",
    count: 0,
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      key: windowKey,
    },
    nodeId,
    swarm: emptySwarm(),
    error: opts?.error,
    authority: nodeId === "japan" ? "jma-family" : "usgs-family",
    attempted: [],
  };
}

function asChip(raw: unknown): SwarmEventChip | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  return {
    id: o.id,
    magnitude:
      o.magnitude == null || o.magnitude === ""
        ? null
        : Number.isFinite(Number(o.magnitude))
          ? Number(o.magnitude)
          : null,
    depthKm: Number(o.depthKm) || 0,
    time: Number(o.time) || 0,
    magType: typeof o.magType === "string" ? o.magType : "?",
  };
}

function normalizeCluster(raw: unknown): SwarmCluster | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  // Legacy: full events array → derive ids/chips
  const legacyEvents = Array.isArray(c.events) ? (c.events as QuakeEvent[]) : [];
  const eventIds = Array.isArray(c.eventIds)
    ? (c.eventIds as string[]).filter((x) => typeof x === "string")
    : legacyEvents.map((e) => e.id).filter(Boolean);

  let topEvents: SwarmEventChip[] = Array.isArray(c.topEvents)
    ? (c.topEvents as unknown[]).map(asChip).filter((x): x is SwarmEventChip => !!x)
    : [];
  if (topEvents.length === 0 && legacyEvents.length) {
    topEvents = legacyEvents.slice(0, 8).map((e) => ({
      id: e.id,
      magnitude: e.magnitude,
      depthKm: e.depthKm,
      time: e.time,
      magType: e.magType,
    }));
  }

  const maxMagEvent =
    asChip(c.maxMagEvent) ??
    topEvents[0] ??
    (eventIds[0]
      ? { id: eventIds[0], magnitude: null, depthKm: 0, time: 0, magType: "?" }
      : null);
  if (!maxMagEvent) return null;

  const depthRange = Array.isArray(c.depthRangeKm)
    ? (c.depthRangeKm as [number, number])
    : ([0, 0] as [number, number]);
  const centroid =
    c.centroid && typeof c.centroid === "object"
      ? (c.centroid as { lat: number; lon: number })
      : { lat: 0, lon: 0 };

  return {
    id: String(c.id ?? `swarm-${eventIds[0] ?? "x"}`),
    start: Number(c.start) || 0,
    end: Number(c.end) || 0,
    eventIds,
    topEvents,
    count: Number(c.count) || eventIds.length,
    maxMag: Number(c.maxMag) || 0,
    maxMagEvent,
    meanDepthKm: Number(c.meanDepthKm) || 0,
    medianDepthKm: Number(c.medianDepthKm) || 0,
    depthRangeKm: depthRange,
    centroid,
    energyProxy: Number(c.energyProxy) || 0,
    ratePerHour: Number(c.ratePerHour) || 0,
    durationHours: Number(c.durationHours) || 0,
    isActive: Boolean(c.isActive),
  };
}

/** Accept partial / malformed server payloads and coerce to a safe shape. */
export function normalizeCatalog(
  raw: unknown,
  fallback?: Partial<CatalogPayload>,
): CatalogPayload {
  const base = emptyCatalog({
    nodeId: fallback?.nodeId,
    windowKey: fallback?.window?.key,
    provider: fallback?.provider,
  });

  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      error: fallback?.error ?? "Catalog payload missing",
    };
  }

  // Unwrap accidental RPC envelopes { result: CatalogPayload }
  let obj = raw as Record<string, unknown>;
  if (
    obj.result &&
    typeof obj.result === "object" &&
    !Array.isArray(obj.events) &&
    Array.isArray((obj.result as { events?: unknown }).events)
  ) {
    obj = obj.result as Record<string, unknown>;
  }

  const events = Array.isArray(obj.events)
    ? (obj.events as QuakeEvent[]).filter(
        (e) =>
          e &&
          typeof e === "object" &&
          Number.isFinite(e.latitude) &&
          Number.isFinite(e.longitude) &&
          Number.isFinite(e.time),
      )
    : [];

  const windowObj =
    obj.window && typeof obj.window === "object"
      ? (obj.window as CatalogPayload["window"])
      : base.window;

  let swarm: SwarmAnalysis;
  if (obj.swarm && typeof obj.swarm === "object") {
    const s = obj.swarm as Partial<SwarmAnalysis> & { clusters?: unknown[] };
    const clusters = Array.isArray(s.clusters)
      ? s.clusters.map(normalizeCluster).filter((c): c is SwarmCluster => !!c)
      : [];
    const active = s.active ? normalizeCluster(s.active) : null;
    swarm = {
      clusters,
      active,
      rate24h: Number(s.rate24h) || 0,
      rate6h: Number(s.rate6h) || 0,
      rate1h: Number(s.rate1h) || 0,
      maxMagWindow: Number(s.maxMagWindow) || 0,
      meanDepthKm: Number(s.meanDepthKm) || 0,
      shallowFraction: Number(s.shallowFraction) || 0,
      cumulativeEnergy: Number(s.cumulativeEnergy) || 0,
      hourlyBins: Array.isArray(s.hourlyBins) ? s.hourlyBins : [],
    };
  } else {
    swarm = analyzeSwarmActivity(events);
  }

  return {
    events,
    provider: (obj.provider as CatalogPayload["provider"]) ?? base.provider,
    fetchedAt: Number(obj.fetchedAt) || Date.now(),
    sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl : "",
    count: Number(obj.count) || events.length,
    window: {
      start: windowObj.start ?? base.window.start,
      end: windowObj.end ?? base.window.end,
      key: (windowObj.key as WindowKey) ?? base.window.key,
    },
    nodeId: (obj.nodeId as FocusNodeId) ?? base.nodeId,
    swarm,
    error: typeof obj.error === "string" ? obj.error : undefined,
    authority:
      (obj.authority as CatalogPayload["authority"]) ??
      ((obj.nodeId as string) === "japan" ? "jma-family" : "usgs-family"),
    attempted: Array.isArray(obj.attempted)
      ? (obj.attempted as SeismicProviderId[])
      : [],
  };
}

/**
 * Classify CF hypocentres for analysis.
 */
export function filterLocalizedEvents(
  events: QuakeEvent[],
  opts?: {
    minMagnitude?: number;
    maxDepthKm?: number;
    requireDepth?: boolean;
  },
): QuakeEvent[] {
  return events.filter((e) => {
    if (!e) return false;
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) return false;
    if (!Number.isFinite(e.time)) return false;
    if (Math.abs(e.latitude) < 0.01 && Math.abs(e.longitude) < 0.01) return false;

    if (opts?.requireDepth) {
      if (!Number.isFinite(e.depthKm) || e.depthKm < 0) return false;
    }

    if (opts?.maxDepthKm != null && Number.isFinite(opts.maxDepthKm)) {
      if (!Number.isFinite(e.depthKm)) return false;
      if (e.depthKm > opts.maxDepthKm) return false;
    }

    if (opts?.minMagnitude != null && Number.isFinite(opts.minMagnitude)) {
      if (e.magnitude == null || !Number.isFinite(e.magnitude)) return false;
      if (e.magnitude < opts.minMagnitude) return false;
    }

    return true;
  });
}
