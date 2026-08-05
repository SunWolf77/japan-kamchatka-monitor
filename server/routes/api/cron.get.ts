/**
 * Vercel Cron / GitHub Actions entrypoint.
 * GET /api/cron — warm Japan + Kamchatka focus-node catalogs.
 *
 * Auth: when CRON_SECRET is set, require Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron injects this automatically when env is configured).
 */
import {
  defineEventHandler,
  getQuery,
  getHeader,
  setHeader,
  createError,
} from "h3";
import { loadCatalogPayload } from "../../../src/lib/seismic/server";
import { listFocusNodes } from "../../../src/lib/seismic/focus-nodes";
import type { FocusNodeId } from "../../../src/lib/seismic/types";
import type { WindowKey } from "../../../src/lib/seismic/catalog";

function authorize(event: Parameters<typeof getHeader>[0]): {
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
  const auth = getHeader(event, "authorization") ?? "";
  if (auth === `Bearer ${secret}`) return { ok: true, status: 200, reason: "bearer" };
  const headerSecret = getHeader(event, "x-cron-secret") ?? "";
  if (headerSecret && headerSecret === secret) {
    return { ok: true, status: 200, reason: "x-cron-secret" };
  }
  return {
    ok: false,
    status: 401,
    reason: "missing or invalid Authorization bearer",
  };
} {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: true, reason: "CRON_SECRET unset — open mode" };
  const auth = getHeader(event, "authorization") ?? "";
  if (auth === `Bearer ${secret}`) return { ok: true };
  const q = getQuery(event);
  if (typeof q.secret === "string" && q.secret === secret) {
    return { ok: true, reason: "query secret" };
  }
  return { ok: false, reason: "missing or invalid Authorization bearer" };
}

function resolveWindow(q: Record<string, unknown>): WindowKey {
  const daysRaw = typeof q.days === "string" ? Number(q.days) : NaN;
  if (Number.isFinite(daysRaw)) {
    if (daysRaw <= 1) return "24h";
    if (daysRaw <= 2) return "48h";
    if (daysRaw <= 7) return "7d";
    return "30d";
  }
  const w = q.window;
  if (w === "24h" || w === "48h" || w === "7d" || w === "30d" || w === "ytd") {
    return w;
  }
  return "7d";
}

export default defineEventHandler(async (event) => {
  const auth = authorize(event);
  if (!auth.ok) {
    throw createError({
      statusCode: auth.status,
      statusMessage: auth.status === 503 ? "Misconfigured" : "Unauthorized",
      data: { detail: auth.reason },
    });
  }

  const q = getQuery(event) as Record<string, unknown>;
  const window = resolveWindow(q);
  const nodes = listFocusNodes().map((n) => n.id as FocusNodeId);
  const t0 = Date.now();

  const regions = await Promise.all(
    nodes.map(async (nodeId) => {
      const start = Date.now();
      try {
        const catalog = await loadCatalogPayload({
          nodeId,
          window,
        });
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
        const failed = Boolean(catalog.error);
        return {
          nodeId,
          ok: !failed,
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
  const vercelCron = getHeader(event, "x-vercel-cron");

  setHeader(event, "cache-control", "no-store");
  setHeader(event, "x-cron-job", "catalog-warm");
  setHeader(event, "content-type", "application/json; charset=utf-8");

  return {
    job: "catalog-warm",
    board: "japan-kamchatka-monitor",
    networkOrder: 3,
    triggeredBy: vercelCron ? "vercel-cron" : "manual",
    auth: auth.reason ?? "bearer",
    ok,
    generatedAt: Date.now(),
    window,
    regions,
    totalEvents,
    durationMs: Date.now() - t0,
  };
});
