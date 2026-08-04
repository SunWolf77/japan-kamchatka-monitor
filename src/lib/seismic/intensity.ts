/**
 * Swarm intensity indicator — ported from
 * https://github.com/SunWolf77/tonga-kermadec-node-monitor
 *
 * Thresholds are node-aware: Tonga tectonic box vs Campi Flegrei dense GOSSIP.
 */

import type { FocusNodeId, QuakeEvent, SwarmAnalysis } from "./types";
import { magValue } from "../utils";

export type IntensityLevel =
  | "Quiet"
  | "Low"
  | "Elevated"
  | "High"
  | "Intense";

export type SwarmIntensity = {
  level: IntensityLevel;
  /** Events per hour over last 6 h */
  ratePerHour6h: number;
  ratePerHour24h: number;
  rate1h: number;
  rate6h: number;
  rate24h: number;
  note: string;
  /** Tone for UI badges */
  tone: "muted" | "accent" | "warn" | "critical";
};

/** Per-hour rate thresholds (events/h over 6 h window). */
const THRESHOLDS: Record<
  FocusNodeId,
  { intense: number; high: number; elevated: number; low: number }
> = {
  // Dense GOSSIP microseismicity — higher bar
  japan: { intense: 8, high: 4, elevated: 1.5, low: 0.5 },
  // Tonga tectonic swarm (from original single-file monitor)
  kamchatka: { intense: 4, high: 2, elevated: 0.8, low: 0.3 },
};

/** Mag class used for "swarm-like signature" notes. */
const NOTE_MAG: Record<FocusNodeId, number> = {
  japan: 4.5,
  kamchatka: 5.5,
};

export function classifySwarmIntensity(
  swarm: SwarmAnalysis,
  events: QuakeEvent[],
  nodeId: FocusNodeId,
  now = Date.now(),
): SwarmIntensity {
  const th = THRESHOLDS[nodeId] ?? THRESHOLDS.japan;
  const rate1h = swarm.rate1h;
  const rate6h = swarm.rate6h;
  const rate24h = swarm.rate24h;
  const ratePerHour6h = rate6h / 6;
  const ratePerHour24h = rate24h / 24;

  let level: IntensityLevel = "Quiet";
  let tone: SwarmIntensity["tone"] = "muted";
  if (ratePerHour6h >= th.intense) {
    level = "Intense";
    tone = "critical";
  } else if (ratePerHour6h >= th.high) {
    level = "High";
    tone = "warn";
  } else if (ratePerHour6h >= th.elevated) {
    level = "Elevated";
    tone = "warn";
  } else if (ratePerHour6h >= th.low) {
    level = "Low";
    tone = "accent";
  }

  const magFloor = NOTE_MAG[nodeId] ?? 3;
  const recent = events.filter((e) => e.time >= now - 7 * 86_400_000);
  const big = recent.filter((e) => magValue(e.magnitude) >= magFloor);
  const mags = big
    .map((e) => e.magnitude!)
    .filter((m) => Number.isFinite(m));

  let note: string;
  if (mags.length >= 3) {
    const mMax = Math.max(...mags);
    const mMin = Math.min(...mags);
    if (mMax - mMin <= 0.8) {
      note = `Swarm-like signature: ${mags.length} × M≥${magFloor} within ${(mMax - mMin).toFixed(1)} magnitude units (no single dominant mainshock).`;
    } else {
      note = `${mags.length} × M≥${magFloor} present. Largest M${mMax.toFixed(1)}.`;
    }
  } else if (mags.length === 2) {
    note = `Two M≥${magFloor} events in the recent window. Sequence remains active.`;
  } else if (mags.length === 1) {
    note = `One M≥${magFloor} (M${mags[0]!.toFixed(1)}). Watching for further activity.`;
  } else {
    note =
      ratePerHour6h > th.low
        ? `Elevated rate of smaller events; no M≥${magFloor} in window yet.`
        : "Low recent activity in focus box.";
  }

  return {
    level,
    ratePerHour6h,
    ratePerHour24h,
    rate1h,
    rate6h,
    rate24h,
    note,
    tone,
  };
}
