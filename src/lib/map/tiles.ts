/**
 * Shared basemap tile config — faster loads + less jank while panning/zooming.
 *
 * Carto public raster tiles now watermark "API KEY REQUIRED".
 * Voyager / Dark use Esri street + dark-gray (no key). Satellite stays Esri imagery.
 * Kind ids (`voyager` / `dark`) kept so map chrome does not churn.
 *
 * - updateWhenIdle: only refresh tiles after pan/zoom settles
 * - keepBuffer: retain adjacent tiles for smoother panning
 * - detectRetina: hi-dpi when available without over-fetching
 */

export type BasemapKind = "satellite" | "voyager" | "dark" | "osm";

export function basemapTileUrl(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  if (kind === "dark") {
    return "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
  }
  if (kind === "voyager") {
    return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  }
  // Esri World Imagery — free, no key, works well for ocean arcs
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
}

export function basemapAttribution(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  return "Tiles &copy; Esri";
}

/** Leaflet tileLayer options tuned for dashboard maps. */
export function basemapTileOptions(kind: BasemapKind = "satellite"): {
  maxZoom: number;
  maxNativeZoom: number;
  minZoom: number;
  updateWhenIdle: boolean;
  updateWhenZooming: boolean;
  keepBuffer: number;
  detectRetina: boolean;
  crossOrigin: boolean;
  attribution: string;
  subdomains?: string;
} {
  const base = {
    maxZoom: kind === "osm" ? 19 : 18,
    maxNativeZoom: kind === "osm" ? 19 : 18,
    minZoom: 3,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
    detectRetina: kind === "osm",
    crossOrigin: true,
    attribution: basemapAttribution(kind),
  };
  if (kind === "osm") {
    return { ...base, subdomains: "abc" };
  }
  return base;
}

/** Default basemap per focus node — satellite for ocean arc, street map for land. */
export function defaultBasemapForNode(nodeId: string): BasemapKind {
  if (nodeId === "kamchatka") return "satellite";
  return "voyager";
}
