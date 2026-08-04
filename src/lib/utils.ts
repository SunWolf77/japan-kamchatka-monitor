import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMag(mag: number | null | undefined): string {
  if (mag == null || Number.isNaN(mag)) return "N/D";
  return mag.toFixed(1);
}

export function magValue(mag: number | null | undefined, fallback = 0): number {
  if (mag == null || Number.isNaN(mag)) return fallback;
  return mag;
}

export function formatDepth(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return "—";
  return `${km.toFixed(1)} km`;
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatDateTime(ts: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ts)) + " UTC";
}

/** Approximate seismic energy proxy (relative, not Joules) from magnitude. */
export function energyProxy(mag: number | null | undefined): number {
  if (mag == null || Number.isNaN(mag)) return 0;
  return Math.pow(10, 1.5 * mag);
}
