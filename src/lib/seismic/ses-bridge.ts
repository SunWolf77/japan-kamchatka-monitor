/**
 * Bridge to sun-earth-sentinel (https://github.com/SunWolf77/sun-earth-sentinel).
 *
 * SES uses USGS EqFeature GeoJSON globally and filters by dragon-node bounds.
 * Campi Flegrei is the "mediterranean" dragon node — USGS is blind there, so this
 * monitor owns the dense INGV-OV catalog and can emit SES-compatible features
 * for merge WITHOUT re-querying USGS for the same box.
 *
 * Merge contract for SES:
 *  1. Global map: keep USGS summary feeds.
 *  2. When focus = mediterranean / campi-flegrei: REPLACE in-bounds USGS
 *     features with `toSesEqFeatures(events)` from this node (INGV authority).
 *  3. Never call both USGS FDSN and INGV for the same CF bbox in one tick.
 */

import type { FocusNodeId, QuakeEvent, SeismicProviderId } from "./types";
import { getAuthority } from "./authority";

/** Subset of SES `EqFeature` — enough for map/list/SUPT merge. */
export type SesEqFeature = {
  type: "Feature";
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    updated?: number;
    url?: string;
    title?: string;
    type?: string;
    status?: string;
    magType?: string | null;
    /** SES extension: which catalog family supplied the feature */
    sesSource?: SeismicProviderId | "ingv-family" | "usgs-family";
    sesNodeId?: FocusNodeId;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number?];
  };
};

export type SesEqCollection = {
  type: "FeatureCollection";
  features: SesEqFeature[];
  metadata?: {
    generated?: number;
    count?: number;
    title?: string;
    authority?: string;
    nodeId?: FocusNodeId;
  };
};

export function toSesEqFeature(
  e: QuakeEvent,
  nodeId?: FocusNodeId,
): SesEqFeature {
  return {
    type: "Feature",
    id: e.id,
    properties: {
      mag: e.magnitude,
      place: e.place,
      time: e.time,
      updated: e.time,
      title: e.magnitude != null ? `M${e.magnitude.toFixed(1)} - ${e.place}` : e.place,
      type: e.eventType,
      status: "reviewed",
      magType: e.magType,
      sesSource: e.provider,
      sesNodeId: nodeId,
    },
    geometry: {
      type: "Point",
      coordinates: [e.longitude, e.latitude, e.depthKm],
    },
  };
}

export function toSesEqCollection(
  events: QuakeEvent[],
  nodeId: FocusNodeId,
): SesEqCollection {
  const policy = getAuthority(nodeId);
  return {
    type: "FeatureCollection",
    features: events.map((e) => toSesEqFeature(e, nodeId)),
    metadata: {
      generated: Date.now(),
      count: events.length,
      title: `SES focus node · ${policy.label}`,
      authority: policy.authority,
      nodeId,
    },
  };
}

/**
 * Merge SES global USGS features with authority-owned node events.
 * Drops any USGS feature that falls inside the node bbox so we never double-plot.
 */
export function mergeSesWithAuthorityNode(opts: {
  globalUsgs: SesEqFeature[];
  nodeEvents: QuakeEvent[];
  nodeId: FocusNodeId;
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}): SesEqCollection {
  const policy = getAuthority(opts.nodeId);
  const { minLat, maxLat, minLon, maxLon } = opts.bbox;

  const outside = opts.globalUsgs.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    if (lat == null || lon == null) return true;
    const inBox = lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    // If this node is INGV-authority, strip USGS inside the box
    if (policy.authority === "ingv-family" && inBox) return false;
    return true;
  });

  const local = opts.nodeEvents.map((e) => toSesEqFeature(e, opts.nodeId));
  const byId = new Map<string, SesEqFeature>();
  for (const f of outside) byId.set(String(f.id), f);
  for (const f of local) byId.set(String(f.id), f);

  const features = [...byId.values()].sort(
    (a, b) => (b.properties.time ?? 0) - (a.properties.time ?? 0),
  );

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      generated: Date.now(),
      count: features.length,
      title: `SES merged · ${policy.sesDragonId} authority=${policy.authority}`,
      authority: policy.authority,
      nodeId: opts.nodeId,
    },
  };
}

/** SES dragon-node id for this focus monitor (for cross-app deep links). */
export function sesDragonIdFor(nodeId: FocusNodeId): string {
  return getAuthority(nodeId).sesDragonId;
}
