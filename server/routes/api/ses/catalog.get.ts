/**
 * Nitro production — SES merge feed (GeoJSON).
 * GET /api/ses/catalog?window=7d&node=japan|kamchatka
 */
import { defineEventHandler, getQuery, setHeader, createError } from "h3";
import { loadCatalogPayload } from "../../../../src/lib/seismic/server";
import { toSesEqCollection } from "../../../../src/lib/seismic/ses-bridge";
import {
  focusNodeFromSesParam,
  sesDragonId,
} from "../../../../src/lib/seismic/ses-handoff";
import type { FocusNodeId } from "../../../../src/lib/seismic/types";
import type { WindowKey } from "../../../../src/lib/seismic/catalog";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const nodeParam =
    (typeof q.node === "string" && q.node) ||
    (typeof q.sesNode === "string" && q.sesNode) ||
    "";
  const windowParam = typeof q.window === "string" ? q.window : "7d";
  const windowKey: WindowKey = ["24h", "48h", "7d", "30d", "ytd"].includes(windowParam)
    ? (windowParam as WindowKey)
    : "7d";
  const nodeId: FocusNodeId = focusNodeFromSesParam(nodeParam) ?? "japan";

  try {
    const catalog = await loadCatalogPayload({
      nodeId,
      window: windowKey,
      // Japan domestic can be deep slab; no hard 8 km cap like CF
      maxDepthKm: undefined,
    });

    const collection = toSesEqCollection(catalog.events ?? [], nodeId);
    setHeader(event, "content-type", "application/json; charset=utf-8");
    setHeader(event, "access-control-allow-origin", "*");
    setHeader(event, "access-control-allow-methods", "GET, OPTIONS");
    setHeader(
      event,
      "cache-control",
      "public, max-age=60, stale-while-revalidate=120",
    );
    setHeader(event, "x-ses-feed", "japan-kamchatka-monitor");

    return {
      ...collection,
      metadata: {
        ...collection.metadata,
        generated: Date.now(),
        count: catalog.count,
        title: `SES focus feed · ${sesDragonId(nodeId)}`,
        authority: catalog.authority,
        nodeId,
        dragonId: sesDragonId(nodeId),
        window: windowKey,
        provider: catalog.provider,
        sourceUrl: catalog.sourceUrl,
        board: "japan-kamchatka-monitor",
        note:
          nodeId === "japan"
            ? "JMA Bosai authority for Japan arc — prefer over USGS inside JP bbox; tsunami via /feeds."
            : "USGS authority for Kamchatka–Kurils. KVERT for volcano status links.",
      },
    };
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : "SES catalog failed",
    });
  }
});
