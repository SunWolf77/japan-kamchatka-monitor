import { createFileRoute } from "@tanstack/react-router";
import { loadCatalogPayload } from "@/lib/seismic/server";
import { listFocusNodes } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId } from "@/lib/seismic/types";
import type { WindowKey } from "@/lib/seismic/catalog";

function authorize(request: Request): {
  ok: boolean;
  status: number;
  reason?: string;
} {
  const secret = process.env.CRON_SECRET?.trim();
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      return {
        ok: false,
        status: 503,
        reason: "CRON_SECRET not configured on this deployment",
      };
    }
    return { ok: true, status: 200, reason: "CRON_SECRET unset — dev open mode" };
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) {
    return { ok: true, status: 200, reason: "bearer" };
  }

  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  if (headerSecret && headerSecret === secret) {
    return { ok: true, status: 200, reason: "x-cron-secret" };
  }

  return {
    ok: false,
    status: 401,
    reason: "missing or invalid Authorization bearer",
  };
}

function resolveWindow(url: URL): WindowKey {
  const daysRaw = Number(url.searchParams.get("days") ?? "");
  if (Number.isFinite(daysRaw) && daysRaw > 0) {
    if (daysRaw <= 1) return "24h";
    if (daysRaw <= 2) return "48h";
    if (daysRaw <= 7) return "7d";
    return "30d";
  }
  const w = url.searchParams.get("window");
  if (w === "24h" || w === "48h" || w === "7d" || w === "30d" || w === "ytd") {
    return w;
  }
  return "7d";
}

export const Route = createFileRoute("/api/cron")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = authorize(request);
        if (!auth.ok) {
          return Response.json(
            {
              ok: false,
              error: auth.status === 503 ? "Misconfigured" : "Unauthorized",
              detail: auth.reason,
            },
            {
              status: auth.status,
              headers: { "Cache-Control": "no-store" },
            },
          );
        }

        const url = new URL(request.url);
        const window = resolveWindow(url);
        const nodes = listFocusNodes().map((n) => n.id as FocusNodeId);
        const t0 = Date.now();

        const regions = await Promise.all(
          nodes.map(async (nodeId) => {
            const start = Date.now();
            try {
              const catalog = await loadCatalogPayload({ nodeId, window });
              const events = catalog.events ?? [];
              const maxMag = events.length
                ? Math.max(...events.map((e) => e.magnitude ?? 0))
                : null;
              const latest = events[0]
                ? {
                    mag: events[0].magnitude,
                    place: events[0].place,
                    time: events[0].time,
                    provider: events[0].provider,
                  }
                : null;
              return {
                nodeId,
                ok: !catalog.error,
                count: catalog.count ?? events.length,
                maxMag,
                latest,
                provider: catalog.provider,
                authority: catalog.authority,
                error: catalog.error,
                durationMs: Date.now() - start,
              };
            } catch (err) {
              return {
                nodeId,
                ok: false,
                count: 0,
                maxMag: null,
                latest: null,
                error: err instanceof Error ? err.message : "warm failed",
                durationMs: Date.now() - start,
              };
            }
          }),
        );

        const ok = regions.every((r) => r.ok);
        const totalEvents = regions.reduce((s, r) => s + (r.count ?? 0), 0);

        return Response.json(
          {
            job: "catalog-warm",
            board: "japan-kamchatka-monitor",
            networkOrder: 3,
            triggeredBy: request.headers.get("x-vercel-cron")
              ? "vercel-cron"
              : "manual",
            auth: auth.reason ?? "bearer",
            ok,
            generatedAt: Date.now(),
            window,
            regions,
            totalEvents,
            durationMs: Date.now() - t0,
          },
          {
            status: ok ? 200 : 207,
            headers: {
              "Cache-Control": "no-store",
              "X-Cron-Job": "catalog-warm",
            },
          },
        );
      },
    },
  },
});
