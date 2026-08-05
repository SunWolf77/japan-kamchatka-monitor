import { createFileRoute } from "@tanstack/react-router";
import {
  volcanoAuthorityLabel,
  volcanoesForNode,
  type WatchedVolcano,
} from "@/lib/seismic/volcano-watch";

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    "X-Ses-Feed": "japan-kamchatka-monitor-volcano",
  };
}

function summarize(list: WatchedVolcano[]) {
  const primary = list[0] ?? null;
  return {
    primary: primary
      ? {
          id: primary.id,
          title: primary.name,
          level: 0,
          acc: "Green",
          activity: primary.note,
        }
      : null,
    volcanoes: list.slice(0, 12).map((v) => ({
      id: v.id,
      title: v.name,
      region: v.region,
      authority: v.authority,
      href: v.href,
      note: v.note,
      lat: v.lat,
      lon: v.lon,
    })),
  };
}

export const Route = createFileRoute("/api/ses/volcano")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: cors() }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const nodeParam = (url.searchParams.get("node") || "japan").toLowerCase();
        const nodeId =
          nodeParam === "kamchatka" || nodeParam === "km" ? "kamchatka" : "japan";
        const list = volcanoesForNode(nodeId);
        const { primary, volcanoes } = summarize(list);
        const authority = volcanoAuthorityLabel(nodeId);

        const plain =
          nodeId === "kamchatka"
            ? "Kamchatka–Kurils volcanoes are watched via KVERT aviation colour codes and IVS bulletins. This board lists key edifices with official links — live colour codes must be confirmed on KVERT. Pair with USGS seismic for the slab. Not a forecast."
            : "Japan arc volcanoes are under JMA volcanic warnings. This feed lists priority edifices (Sakurajima, Aso, Tokara/Suwanosejima, etc.) with JMA Bosai map links. Confirm any warning level on JMA before decisions. Seismic catalog (JMA Bosai) remains the dense domestic pulse. Not a forecast.";

        return Response.json(
          {
            type: "ses-volcano-status",
            board: "japan-kamchatka-monitor",
            networkOrder: 3,
            dragonId: nodeId,
            name: nodeId === "kamchatka" ? "Kamchatka–Kurils" : "Japan Arc",
            ok: true,
            generatedAt: Date.now(),
            authority,
            primary,
            elevatedCount: 0,
            recentChanges: [],
            resonance: {
              severity: "quiet",
              headline:
                nodeId === "kamchatka"
                  ? "KVERT-linked watchlist ready"
                  : "JMA volcano watchlist ready",
              plain,
            },
            href:
              nodeId === "kamchatka"
                ? "https://japan-kamchatka-monitor.vercel.app/?node=kamchatka"
                : "https://japan-kamchatka-monitor.vercel.app/",
            volcanoes,
            metadata: {
              note: "Watchlist + authority links. Live alert levels require JMA/KVERT pages — not dual-read with USGS for Japan domestic.",
              nodeId,
            },
          },
          { headers: cors() },
        );
      },
    },
  },
});
