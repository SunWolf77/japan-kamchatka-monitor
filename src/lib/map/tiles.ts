/**
 * Shared basemap tile config — faster loads + less jank while panning/zooming.
 *
 * - updateWhenIdle: only refresh tiles after pan/zoom settles
 * - keepBuffer: retain adjacent tiles for smoother panning
 * - detectRetina: hi-dpi when available without over-fetching
 * Satellite (Esri) is preferred for ocean/arc nodes (TK); Voyager for land caldera (CF).
 */

export type BasemapKind = "satellite" | "voyager" | "dark" | "osm";

export function basemapTileUrl(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  if (kind === "dark") {
    return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  }
  if (kind === "voyager") {
    return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  }
  // Esri World Imagery — free, no key, works well for SW Pacific arc
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
}

export function basemapAttribution(kind: BasemapKind = "satellite"): string {
  if (kind === "osm") {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  }
  if (kind === "satellite") {
    return "Tiles &copy; Esri";
  }
  return (
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ' +
    '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  );
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
    maxZoom: kind === "satellite" ? 18 : 19,
    maxNativeZoom: kind === "satellite" ? 18 : 19,
    minZoom: 3,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
    detectRetina: kind !== "satellite",
    crossOrigin: true,
    attribution: basemapAttribution(kind),
  };
  if (kind === "satellite") return base;
  return {
    ...base,
    subdomains: kind === "osm" ? "abc" : "abcd",
  };
}

/** Default basemap per focus node — satellite for ocean arc, voyager for land caldera. */
export function defaultBasemapForNode(nodeId: string): BasemapKind {
  if (nodeId === "kamchatka") return "satellite";
  return "voyager";
}
