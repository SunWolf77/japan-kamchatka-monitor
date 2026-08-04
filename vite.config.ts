import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Proxy Tomsk SOSRFF charts in dev (and any Vite middleware path).
 * Production Nitro route: server/routes/api/tomsk.get.ts
 */
function tomskProxyPlugin(): Plugin {
  return {
    name: "ses:tomsk-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/api/tomsk") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() === "HEAD") {
            // Health probe without body
            const u = new URL(rawUrl, "http://local");
            const file = u.searchParams.get("file") ?? "";
            const mod = (await server.ssrLoadModule(
              "/src/lib/supt/tomskProxy.server.ts",
            )) as {
              fetchTomskChart: (f: string) => Promise<
                | { ok: true; body: ArrayBuffer; contentType: string; upstream: string }
                | { ok: false; status: number; message: string; upstream?: string }
              >;
            };
            const result = await mod.fetchTomskChart(file);
            if (!result.ok) {
              res.statusCode = result.status;
              res.end();
              return;
            }
            res.statusCode = 200;
            res.setHeader("content-type", result.contentType);
            res.setHeader("content-length", String(result.body.byteLength));
            res.setHeader("cache-control", "public, max-age=120");
            res.end();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          const u = new URL(rawUrl, "http://local");
          const file = u.searchParams.get("file") ?? "";
          const mod = (await server.ssrLoadModule(
            "/src/lib/supt/tomskProxy.server.ts",
          )) as {
            fetchTomskChart: (f: string) => Promise<
              | { ok: true; body: ArrayBuffer; contentType: string; upstream: string }
              | { ok: false; status: number; message: string; upstream?: string }
            >;
          };
          const result = await mod.fetchTomskChart(file);
          if (!result.ok) {
            res.statusCode = result.status;
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                error: result.message,
                upstream: result.upstream,
              }),
            );
            return;
          }
          res.statusCode = 200;
          res.setHeader("content-type", result.contentType);
          res.setHeader(
            "cache-control",
            "public, max-age=120, stale-while-revalidate=600",
          );
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("x-tomsk-upstream", result.upstream);
          res.end(Buffer.from(result.body));
        } catch (err) {
          console.error("[ses] tomsk proxy failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "tomsk proxy failed" }));
          }
        }
      });
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */

/**
 * Public SES catalog GeoJSON for Sentinel merge (dev middleware).
 * Production: server/routes/api/ses/catalog.get.ts
 */
function sesCatalogPlugin(): Plugin {
  return {
    name: "ses:catalog-feed",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/api/ses/catalog") {
            next();
            return;
          }
          const method = (req.method ?? "GET").toUpperCase();
          if (method === "OPTIONS") {
            res.statusCode = 204;
            res.setHeader("access-control-allow-origin", "*");
            res.setHeader("access-control-allow-methods", "GET, OPTIONS");
            res.end();
            return;
          }
          if (method !== "GET" && method !== "HEAD") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          const u = new URL(rawUrl, "http://local");
          const mod = (await server.ssrLoadModule("/src/lib/seismic/server.ts")) as {
            loadCatalogPayload: (q: Record<string, unknown>) => Promise<{
              events: unknown[];
              count: number;
              authority: string;
              provider: string;
              sourceUrl: string;
            }>;
          };
          const bridge = (await server.ssrLoadModule(
            "/src/lib/seismic/ses-bridge.ts",
          )) as {
            toSesEqCollection: (
              events: unknown[],
              nodeId: string,
            ) => Record<string, unknown>;
          };
          const handoff = (await server.ssrLoadModule(
            "/src/lib/seismic/ses-handoff.ts",
          )) as {
            focusNodeFromSesParam: (raw: string | null) => string | null;
            sesDragonId: (id: string) => string;
          };
          const nodeParam = u.searchParams.get("node") || u.searchParams.get("sesNode");
          const windowKey = u.searchParams.get("window") || "7d";
          const nodeId =
            handoff.focusNodeFromSesParam(nodeParam) ?? "campi-flegrei";
          const catalog = await mod.loadCatalogPayload({
            nodeId,
            window: windowKey,
            maxDepthKm: nodeId === "campi-flegrei" ? 8 : undefined,
          });
          const collection = bridge.toSesEqCollection(
            catalog.events as never[],
            nodeId,
          );
          const body = JSON.stringify({
            ...collection,
            metadata: {
              ...(collection.metadata as object),
              generated: Date.now(),
              count: catalog.count,
              title: `SES focus feed · ${handoff.sesDragonId(nodeId)}`,
              authority: catalog.authority,
              nodeId,
              dragonId: handoff.sesDragonId(nodeId),
              window: windowKey,
              provider: catalog.provider,
              sourceUrl: catalog.sourceUrl,
              board: "campi-flegrei-monitor",
            },
          });
          res.statusCode = 200;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("cache-control", "public, max-age=60");
          if (method === "HEAD") {
            res.end();
            return;
          }
          res.end(body);
        } catch (err) {
          console.error("[ses] catalog feed failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "ses catalog failed" }));
          }
        }
      });
    },
  };
}

function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// Keep `nitro` gated to `build` (the Vercel deploy target): enabled in dev it
// opens a second dev-server port, which breaks the single-port preview.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    pgliteBootstrapPlugin(),
    tomskProxyPlugin(),
    sesCatalogPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" ? [nitro({ preset: "vercel" })] : []),
    viteReact(),
  ],
}));
