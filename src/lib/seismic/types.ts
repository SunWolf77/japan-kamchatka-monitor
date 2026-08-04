/**
 * Unified quake model — USGS GeoJSON + JMA Bosai for Japan–Kamchatka SES node #3.
 * Compatible with sun-earth-sentinel EqFeature merge (ses-bridge).
 *
 * Magnitude conventions:
 *  - USGS: typically mb/ml/mw; null rare
 *  - JMA: Mj (MJMA); intensity-only products may approximate from shindo
 * Never coerce missing mag to 0 (that invents energy).
 */

export type SeismicProviderId = "jma" | "usgs" | "ingv" | "gossip";

export type QuakeEvent = {
  id: string;
  time: number; // epoch ms
  latitude: number;
  longitude: number;
  /** Hypocentral depth in km (positive down). */
  depthKm: number;
  /** Magnitude; null when source reports N/D. */
  magnitude: number | null;
  magType: string;
  place: string;
  eventType: string;
  /** Source agency / catalog author (e.g. jma, us, ak). */
  author: string;
  /** Provider that supplied this event. */
  provider: SeismicProviderId;
  /** Optional network / catalog labels for multi-node dashboards. */
  catalog?: string;
  contributor?: string;
  /** JMA seismic intensity (shindo) when known. */
  jmaMaxi?: string | null;
  /** Never include in SSR/RPC transport. */
  raw?: Record<string, string>;
};

/** Compact chip for swarm UI — not a full QuakeEvent (avoids nested payload bloat). */
export type SwarmEventChip = {
  id: string;
  magnitude: number | null;
  depthKm: number;
  time: number;
  magType: string;
};

export type BBox = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

export type GeoPoint = { lat: number; lon: number };

/** SES focus nodes hosted on this Japan–Kamchatka board. */
export type FocusNodeId = "japan" | "kamchatka";

export type FocusNode = {
  id: FocusNodeId;
  /** Display name */
  name: string;
  /** Short code for badges */
  code: string;
  /** Order in sun-earth-sentinel network (1 = first, 2 = second, …) */
  networkOrder: number;
  network: "sun-earth-sentinel";
  description: string;
  region: string;
  /** Preferred provider for this node. */
  provider: SeismicProviderId;
  /** Fallback provider when primary fails (same authority family only). */
  fallbackProvider?: SeismicProviderId;
  bbox: BBox;
  /** Optional tighter initial map frame (does not affect catalog query bbox). */
  mapView?: BBox;
  center: GeoPoint;
  /** Map zoom / extent padding in degrees */
  mapPad: number;
  volcano?: {
    name: string;
    type: string;
    /** Static context — live alert comes from operational bulletins when wired. */
    statusNote: string;
    /** Approximate caldera / edifice outline (closed ring of [lon, lat]). */
    outline?: [number, number][];
    /** Official local catalog map. */
    officialMapUrl?: string;
  };
  /** Typical shallow seismogenic zone top/bottom for depth coloring. */
  depthRangeKm: { shallow: number; deep: number };
  /** Tsunami-relevant shelf / coastal corridor flag. */
  tsunamiWatch?: boolean;
};

export type QueryWindow = {
  start: Date;
  end: Date;
  minMagnitude?: number;
  limit?: number;
};

export type SeismicQuery = QueryWindow & {
  node: FocusNode;
};

export type FetchResult = {
  events: QuakeEvent[];
  provider: SeismicProviderId;
  fetchedAt: number;
  sourceUrl: string;
  count: number;
  window: { start: string; end: string };
  nodeId: FocusNodeId;
  /** Authority family that produced this result (never mixed). */
  authority?: "jma-family" | "usgs-family" | "ingv-family";
  /** Providers attempted (for feed health; not dual-read merge). */
  attempted?: SeismicProviderId[];
};

export type SwarmCluster = {
  id: string;
  start: number;
  end: number;
  /** All member ids — resolve against catalog; do not nest full events in SSR. */
  eventIds: string[];
  /** Top chips for UI (max 8). */
  topEvents: SwarmEventChip[];
  count: number;
  maxMag: number;
  maxMagEvent: SwarmEventChip;
  meanDepthKm: number;
  medianDepthKm: number;
  depthRangeKm: [number, number];
  centroid: GeoPoint;
  /** Cumulative energy proxy relative to M3 baseline. */
  energyProxy: number;
  /** Events per hour within the cluster window. */
  ratePerHour: number;
  durationHours: number;
  isActive: boolean;
};

export type SwarmAnalysis = {
  clusters: SwarmCluster[];
  active: SwarmCluster | null;
  rate24h: number;
  rate6h: number;
  rate1h: number;
  maxMagWindow: number;
  meanDepthKm: number;
  shallowFraction: number;
  cumulativeEnergy: number;
  hourlyBins: { t: number; count: number; maxMag: number; meanDepth: number }[];
};

/** Resolve cluster members from the top-level catalog by id. */
export function resolveClusterEvents(
  cluster: SwarmCluster | null | undefined,
  catalog: QuakeEvent[],
): QuakeEvent[] {
  if (!cluster?.eventIds?.length || !catalog?.length) return [];
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const out: QuakeEvent[] = [];
  for (const id of cluster.eventIds) {
    const e = byId.get(id);
    if (e) out.push(e);
  }
  return out;
}
