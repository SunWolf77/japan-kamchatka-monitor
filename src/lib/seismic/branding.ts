/**
 * Product titles — full names for chrome/SEO; short codes only for switchers.
 */
import type { FocusNodeId } from "./types";

export const NETWORK_FULL = "Sun-Earth-Sentinel";
export const NETWORK_SHORT = "SES";

/** Dedicated swarm-board product titles (Vercel node monitors). */
export const NODE_MONITOR_TITLE: Record<FocusNodeId, string> = {
  japan: "Japan Arc Monitor",
  kamchatka: "Kamchatka–Kurils Monitor",
};

export const NODE_MONITOR_SHORT: Record<FocusNodeId, string> = {
  japan: "JP",
  kamchatka: "KM",
};

export function nodeMonitorTitle(nodeId: FocusNodeId | string): string {
  if (nodeId in NODE_MONITOR_TITLE) {
    return NODE_MONITOR_TITLE[nodeId as FocusNodeId];
  }
  return NODE_MONITOR_TITLE.japan;
}

/** Subtitle under H1 — full network name, never acronym alone. */
export function nodeMonitorSubtitle(
  networkOrder: number,
  authorityShort: string,
): string {
  return `${NETWORK_FULL} · focus node #${networkOrder} · ${authorityShort}`;
}

/** Browser tab title. */
export function documentTitleForNode(nodeId: FocusNodeId): string {
  return `${nodeMonitorTitle(nodeId)} · ${NETWORK_FULL}`;
}
