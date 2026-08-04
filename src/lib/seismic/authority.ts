/**
 * Catalog authority routing for SES Japan–Kamchatka node #3.
 *
 * Rule: ONE authority family per node. Never dual-read JMA + USGS as co-primary
 * for the same Japan domestic box — that double-counts and mixes Mj vs Mw.
 *
 *  Japan     → JMA Bosai primary; USGS fallback only if JMA empty (same family intent)
 *  Kamchatka → USGS only (JMA has no dense catalog there)
 */

import type { FocusNodeId, SeismicProviderId } from "./types";

export type CatalogAuthority = "jma-family" | "usgs-family" | "ingv-family";

export type NodeAuthorityPolicy = {
  nodeId: FocusNodeId;
  /** Exclusive family — SES merge must not mix families for this node. */
  authority: CatalogAuthority;
  /** Ordered exclusive provider chain (first success wins, no merge). */
  chain: SeismicProviderId[];
  /** Providers that must never be queried for this node. */
  blocked: SeismicProviderId[];
  /** SES dragon-node id (sun-earth-sentinel DRAGON_NODES). */
  sesDragonId: string;
  /** Human label for feed health strip. */
  label: string;
  rationale: string;
};

export const NODE_AUTHORITY: Record<FocusNodeId, NodeAuthorityPolicy> = {
  japan: {
    nodeId: "japan",
    authority: "jma-family",
    chain: ["jma", "usgs"],
    blocked: ["ingv", "gossip"],
    sesDragonId: "japan",
    label: "JMA Bosai (→ USGS bbox fill)",
    rationale:
      "JMA is the national authority for Japanese seismicity (Mj + shindo). USGS is allowed only as soft-empty fill for offshore events the Bosai list may lag — not dual-read merge of the same hypocenter set.",
  },
  kamchatka: {
    nodeId: "kamchatka",
    authority: "usgs-family",
    chain: ["usgs"],
    blocked: ["jma", "ingv", "gossip"],
    sesDragonId: "kamchatka",
    label: "USGS FDSN / realtime",
    rationale:
      "Kamchatka–Kurils are covered by the USGS global FDSN catalog used by sun-earth-sentinel. JMA Bosai is Japan-domestic and is not the authority for the Russian Far East box.",
  },
};

export function getAuthority(nodeId: FocusNodeId | string): NodeAuthorityPolicy {
  if (nodeId in NODE_AUTHORITY) return NODE_AUTHORITY[nodeId as FocusNodeId];
  return NODE_AUTHORITY.japan;
}

/**
 * Build the exclusive fetch chain for a node.
 * forceProvider is allowed only if it belongs to the node's authority family;
 * cross-family force is ignored (never dual-read).
 */
export function resolveProviderChain(
  nodeId: FocusNodeId,
  forceProvider?: SeismicProviderId,
): { chain: SeismicProviderId[]; authority: CatalogAuthority; forced: boolean } {
  const policy = getAuthority(nodeId);

  if (forceProvider) {
    if (policy.blocked.includes(forceProvider)) {
      return { chain: [...policy.chain], authority: policy.authority, forced: false };
    }
    if (policy.chain.includes(forceProvider)) {
      const rest = policy.chain.filter((p) => p !== forceProvider);
      return {
        chain: [forceProvider, ...rest],
        authority: policy.authority,
        forced: true,
      };
    }
  }

  return { chain: [...policy.chain], authority: policy.authority, forced: false };
}

export function isProviderAllowed(
  nodeId: FocusNodeId,
  provider: SeismicProviderId,
): boolean {
  const policy = getAuthority(nodeId);
  return policy.chain.includes(provider) && !policy.blocked.includes(provider);
}
