import { createFileRoute } from "@tanstack/react-router";
import { buildBoardHealth } from "@/lib/health";

/**
 * Public health probe — no auth.
 * GET /api/health · GET /api/health?deep=1 · HEAD /api/health
 */
function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "X-Health-Board": "japan-kamchatka-monitor",
    ...extra,
  };
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: jsonHeaders() }),
      HEAD: async ({ request }) => {
        const deep = new URL(request.url).searchParams.get("deep") === "1";
        const payload = await buildBoardHealth({ deep });
        return new Response(null, {
          status: payload.ok ? 200 : 503,
          headers: jsonHeaders({ "X-Health-Status": payload.status }),
        });
      },
      GET: async ({ request }) => {
        const deep = new URL(request.url).searchParams.get("deep") === "1";
        const payload = await buildBoardHealth({ deep });
        return Response.json(payload, {
          status: payload.ok ? 200 : 503,
          headers: jsonHeaders({ "X-Health-Status": payload.status }),
        });
      },
    },
  },
});
