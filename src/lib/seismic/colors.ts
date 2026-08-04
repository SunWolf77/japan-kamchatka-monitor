import { magValue } from "../utils";

/**
 * Magnitude → fill color (hardcoded hex for Leaflet pathOptions).
 * CSS custom properties do NOT resolve in Leaflet circleMarker fillColor.
 */
export function magColor(mag: number | null | undefined): string {
  if (mag == null || Number.isNaN(mag)) return "#9aa3ad";
  if (mag >= 5.5) return "#c62828";
  if (mag >= 4.5) return "#e05555";
  if (mag >= 3.5) return "#d4784a";
  if (mag >= 2.5) return "#c9a05a";
  if (mag >= 1.5) return "#6a9bb0";
  return "#5a6570";
}

/**
 * Depth → fill color (shallow = warm, deeper = cool).
 * Hex only — safe for Leaflet. `shallow`/`deep` are node-specific gates.
 */
export function depthColor(depthKm: number, shallow = 1.5, deep = 5): string {
  if (!Number.isFinite(depthKm)) return "#9aa3ad";
  if (depthKm <= shallow) return "#e07060";
  if (depthKm >= deep) return "#5a8fbf";
  // interpolate mid band
  const t = (depthKm - shallow) / Math.max(0.01, deep - shallow);
  if (t < 0.35) return "#e08a50";
  if (t < 0.65) return "#c9a05a";
  return "#7a9eb8";
}

/**
 * Time-age color matching INGV GOSSIP Localizzazioni legend style:
 * recent = red, mid = yellow/orange, older = green.
 * `age01` is 0 (newest) → 1 (oldest in the current window).
 */
export function timeAgeColor(age01: number): string {
  const t = Math.max(0, Math.min(1, age01));
  if (t < 0.15) return "#e53935"; // recent red
  if (t < 0.35) return "#fb8c00"; // orange
  if (t < 0.55) return "#fdd835"; // yellow
  if (t < 0.75) return "#9ccc65"; // lime
  return "#43a047"; // green older
}

export function eventAge01(time: number, tMin: number, tMax: number): number {
  if (tMax <= tMin) return 0;
  return (tMax - time) / (tMax - tMin);
}

/** Marker radius — floor high enough that micro-events stay visible on the map. */
export function magRadius(mag: number | null | undefined, min = 5, max = 22): number {
  const m = magValue(mag, 0.3);
  const t = Math.max(0, Math.min(1, (m - 0.3) / 4.5));
  return min + t * t * (max - min);
}

/** Pixel radius for Leaflet circle markers (slightly larger for basemap context). */
export function leafletMagRadius(mag: number | null | undefined): number {
  return magRadius(mag, 4, 18);
}
