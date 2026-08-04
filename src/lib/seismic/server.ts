import { createServerFn } from "@tanstack/react-start";
import { getFocusNode } from "./focus-nodes";
import { fetchForNode } from "./providers";
import type {
  FocusNodeId,
  QuakeEvent,
  SeismicProviderId,
  SwarmAnalysis,
} from "./types";
import { analyzeSwarmActivity } from "./swarm";
import { getAuthority, resolveProviderChain } from "./authority";
import {
  emptyCatalog,
  filterLocalizedEvents,
  normalizeCatalog,
  type CatalogPayload,
  type WindowKey,
} from "./catalog";

export type { CatalogPayload, WindowKey };

function windowToRange(key: WindowKey, now = Date.now()): { start: Date; end: Date } {
  const end = new Date(now);
  if (key === "ytd") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1, 0, 0, 0));
    return { start, end };
  }
  const hours =
    key === "24h" ? 24 : key === "48h" ? 48 : key === "7d" ? 24 * 7 : 24 * 30;
  const start = new Date(now - hours * 3_600_000);
  return { start, end };
}

function buildSwarm(events: QuakeEvent[], nodeId: FocusNodeId): SwarmAnalysis {
  try {
    return analyzeSwarmActivity(events, {
      maxGapMs: nodeId === "japan" ? 3 * 3_600_000 : 6 * 3_600_000,
      maxRadiusKm: nodeId === "japan" ? 40 : 100,
      minEvents: nodeId === "japan" ? 5 : 6,
      now: Date.now(),
    });
  } catch {
    return analyzeSwarmActivity([]);
  }
}

/** Strip bulky fields — transport-only events. */
function slimEvents(events: QuakeEvent[]): QuakeEvent[] {
  return events.map((e) => ({
    id: e.id,
    time: e.time,
    latitude: e.latitude,
    longitude: e.longitude,
    depthKm: e.depthKm,
    magnitude: e.magnitude,
    magType: e.magType,
    place: e.place,
    eventType: e.eventType,
    author: e.author,
    provider: e.provider,
    catalog: e.catalog,
    // no raw, no contributor noise
  }));
}

/** Cap cluster id lists for RPC; topEvents already small. */
function slimSwarm(swarm: SwarmAnalysis): SwarmAnalysis {
  const slim = (c: NonNullable<SwarmAnalysis["active"]>) => ({
    ...c,
    // Keep ids for resolve; cap for transport (UI uses topEvents + count)
    eventIds: (c.eventIds ?? []).slice(0, 200),
    topEvents: (c.topEvents ?? []).slice(0, 8),
  });
  return {
    ...swarm,
    active: swarm.active ? slim(swarm.active) : null,
    clusters: (swarm.clusters ?? []).slice(0, 20).map(slim),
    hourlyBins: (swarm.hourlyBins ?? []).slice(-72),
  };
}

export type CatalogQuery = {
  nodeId?: string;
  window?: WindowKey;
  minMagnitude?: number;
  maxDepthKm?: number;
  forceProvider?: SeismicProviderId;
  /** When true, return KPI-only shell (no events) for ultra-light SSR. */
  metaOnly?: boolean;
};

/** Core catalog load — used by createServerFn + Nitro SES feed. */
export async function loadCatalogPayload(input: CatalogQuery = {}): Promise<CatalogPayload> {
    const nodeId = (input.nodeId ?? "japan") as FocusNodeId;
    const windowKey = (input.window ?? "7d") as WindowKey;
    const node = getFocusNode(nodeId);
    const { start, end } = windowToRange(windowKey);
    const policy = getAuthority(nodeId);
    const { chain } = resolveProviderChain(nodeId, input.forceProvider);

    // Only allow force within family
    const forceProvider =
      input.forceProvider && chain.includes(input.forceProvider)
        ? input.forceProvider
        : undefined;

    const maxDepthKm =
      input.maxDepthKm !== undefined
        ? input.maxDepthKm > 0
          ? input.maxDepthKm
          : undefined
        : node.id === "japan"
          ? 8
          : undefined;

    if (input.metaOnly) {
      return {
        ...emptyCatalog({
          nodeId,
          windowKey,
          provider: chain[0] ?? node.provider,
        }),
        authority: policy.authority,
        attempted: [],
      };
    }

    try {
      const result = await fetchForNode(node, {
        start,
        end,
        minMagnitude: input.minMagnitude,
        limit: windowKey === "ytd" || windowKey === "30d" ? 4000 : 2000,
        forceProvider,
      });

      const rawEvents = Array.isArray(result?.events) ? result.events : [];
      const events = slimEvents(
        filterLocalizedEvents(rawEvents, {
          minMagnitude: input.minMagnitude,
          maxDepthKm,
          requireDepth: false,
        }),
      );

      const swarm = slimSwarm(buildSwarm(events, nodeId));

      return {
        events,
        provider: result?.provider ?? forceProvider ?? node.provider,
        fetchedAt: result?.fetchedAt ?? Date.now(),
        sourceUrl: result?.sourceUrl ?? "",
        count: events.length,
        window: {
          start: result?.window?.start ?? start.toISOString(),
          end: result?.window?.end ?? end.toISOString(),
          key: windowKey,
        },
        nodeId: result?.nodeId ?? nodeId,
        swarm,
        authority: result?.authority ?? policy.authority,
        attempted: result?.attempted ?? [result?.provider ?? node.provider],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Catalog fetch failed";
      return {
        ...emptyCatalog({
          nodeId,
          windowKey,
          provider: forceProvider ?? node.provider,
          error: message,
        }),
        authority: policy.authority,
        attempted: [],
      };
    }
}

export const fetchCatalog = createServerFn({ method: "GET" })
  .validator((data: CatalogQuery) => data ?? {})
  .handler(async ({ data }): Promise<CatalogPayload> => {
    return loadCatalogPayload(data ?? {});
  });

export function coerceCatalogPayload(
  raw: unknown,
  fallback?: Partial<CatalogPayload>,
): CatalogPayload {
  return normalizeCatalog(raw, fallback);
}
