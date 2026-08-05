/**
 * Health payload for /api/health — shallow (default) or deep agency probes.
 */
import { listFocusNodes } from "@/lib/seismic/focus-nodes";

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export type HealthCheck = {
  name: string;
  status: CheckStatus;
  detail?: string;
  durationMs?: number;
  httpStatus?: number;
};

export type HealthPayload = {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  board: string;
  networkOrder: number;
  version: string;
  generatedAt: number;
  env: {
    vercel: boolean;
    vercelEnv: string | null;
    nodeEnv: string | null;
    region: string | null;
  };
  checks: HealthCheck[];
  endpoints: Record<string, string>;
  nodes: Array<{ id: string; name?: string }>;
};

function cronSecretCheck(): HealthCheck {
  const configured = Boolean(process.env.CRON_SECRET?.trim());
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  if (configured) {
    return { name: "cron_secret", status: "ok", detail: "configured" };
  }
  if (isProd) {
    // Degraded, not dead — app is up; cron is locked until secret is set
    return {
      name: "cron_secret",
      status: "warn",
      detail: "missing — /api/cron fails closed (503) until configured",
    };
  }
  return {
    name: "cron_secret",
    status: "warn",
    detail: "unset (dev open mode)",
  };
}

export async function probeUrl(
  name: string,
  url: string,
  timeoutMs = 4500,
): Promise<HealthCheck> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "ses-health-probe/1.0",
      },
      cache: "no-store",
    });
    const durationMs = Date.now() - t0;
    if (res.ok) {
      return {
        name,
        status: "ok",
        detail: "reachable",
        durationMs,
        httpStatus: res.status,
      };
    }
    return {
      name,
      status: res.status >= 500 ? "fail" : "warn",
      detail: `HTTP ${res.status}`,
      durationMs,
      httpStatus: res.status,
    };
  } catch (err) {
    return {
      name,
      status: "fail",
      detail: err instanceof Error ? err.message : "probe failed",
      durationMs: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(
  checks: HealthCheck[],
): Pick<HealthPayload, "ok" | "status"> {
  const appFail = checks.some((c) => c.name === "app" && c.status === "fail");
  if (appFail) return { ok: false, status: "unhealthy" };
  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");
  if (hasFail || hasWarn) return { ok: true, status: "degraded" };
  return { ok: true, status: "healthy" };
}

export async function buildBoardHealth(opts: {
  deep?: boolean;
}): Promise<HealthPayload> {
  const checks: HealthCheck[] = [
    { name: "app", status: "ok", detail: "japan-kamchatka-monitor" },
    cronSecretCheck(),
  ];

  const nodes = listFocusNodes().map((n) => ({ id: n.id, name: n.name ?? n.id }));
  checks.push({
    name: "nodes",
    status: "ok",
    detail: nodes.map((n) => n.id).join(", "),
  });

  if (opts.deep) {
    checks.push(
      await probeUrl(
        "agency_usgs",
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
      ),
      await probeUrl(
        "agency_jma_bosai",
        "https://www.jma.go.jp/bosai/quake/data/list.json",
      ),
    );
  }

  const { ok, status } = summarize(checks);
  return {
    ok,
    status,
    board: "japan-kamchatka-monitor",
    networkOrder: 3,
    version: "0.1.0",
    generatedAt: Date.now(),
    env: {
      vercel: process.env.VERCEL === "1",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    checks,
    endpoints: {
      health: "/api/health",
      healthDeep: "/api/health?deep=1",
      cron: "/api/cron",
      sesCatalog: "/api/ses/catalog",
    },
    nodes,
  };
}
