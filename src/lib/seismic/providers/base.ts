import type { FetchResult, SeismicProviderId, SeismicQuery } from "../types";

/**
 * Provider interface — USGS GeoJSON and INGV FDSN both implement this so
 * focus nodes can swap catalogs without rewriting the dashboard.
 */
export interface SeismicProvider {
  id: SeismicProviderId;
  label: string;
  fetchEvents(query: SeismicQuery): Promise<FetchResult>;
}

export function isoUtc(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

export function clampLimit(n: number | undefined, fallback = 500, max = 2000): number {
  if (!n || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}
