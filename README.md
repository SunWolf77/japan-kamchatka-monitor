# Japan–Kamchatka Monitor · Sun-Earth-Sentinel node #3

Observational seismic / volcanic / **tsunami** monitor for the **Japan Arc** (primary, JMA Bosai) and **Kamchatka–Kurils** (USGS + KVERT links), built to interchange with the [Sun-Earth-Sentinel](https://github.com/SunWolf77/sun-earth-sentinel) network alongside Tonga–Kermadec (#1) and Campi Flegrei (#2).

> **Not a civil-protection product.** SUPT / Continuum / Schumann layers are pattern-detection tools, not forecasts. For official warnings use JMA, PTWC, and local authorities.

## Features

| Layer | What |
| --- | --- |
| **Authority routing** | Japan → JMA Bosai (→ USGS fill); Kamchatka → USGS. No dual-read invent |
| **Tsunami watch** | JMA VTSE bulletins + M≥6 shallow source candidates (new vs #1/#2 boards) |
| **Volcano watch** | Japan arc watchlist (JMA links) + Kamchatka/Kurils (KVERT) |
| **Map / depth / swarms** | OSM basemap, depth gates, swarm intensity, cluster cards |
| **SUPT detective** | Frozen probe, ETAS residual, stress nodes (Focus / Advanced) |
| **Continuum EII** | Md + shallow + ψₛ (Kp/solar wind) + Schumann ELF factor |
| **SES interchange** | Network bar · `?from=ses&sesNode=japan\|kamchatka` · `/api/ses/catalog` GeoJSON |

## Stack

- React 19 · TypeScript · Vite 8 · TanStack Start / Router / Query
- Tailwind v4 · Radix/shadcn · Leaflet · Recharts · Zustand
- Deploy: **Vercel** via Nitro preset (`vite.config.ts` — nitro only on `build`)

## Local develop

```bash
npm install
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm run build
```

## Deploy

**Repo:** [github.com/SunWolf77/japan-kamchatka-monitor](https://github.com/SunWolf77/japan-kamchatka-monitor)

1. Vercel → **Import** this repo  
2. Build: `npm run build` · Node **22**  
3. Env for core monitor: **none required**  
4. Production URL expected: `https://japan-kamchatka-monitor.vercel.app/`

### Handoff contract (SES)

- Sentinel → board: `?from=ses&sesNode=japan` or `sesNode=kamchatka`
- Board → Sentinel: `https://sun-earth-sentinel.vercel.app/?tab=live&node=japan`
- Catalog feed: `GET /api/ses/catalog?window=7d&node=japan`

### Network order

| # | Board | Authority |
| --- | --- | --- |
| 1 | Tonga–Kermadec | USGS |
| 2 | Campi Flegrei | INGV-OV GOSSIP |
| **3** | **Japan–Kamchatka** | **JMA / USGS** |

## License / methodology

- Sheppard’s Universal Proxy Theory (SUPT) — U.S. Copyright TXu 2-468-771  
- Seismic / tsunami data © JMA / USGS / KVERT — use per their terms  

---

*SunWolf · SolWatch / SES observational network*

## Catalog cron (Vercel + GitHub Actions)

Keeps focus-node catalogs warm for SES and first visitors.

| Layer | Schedule | Path |
|-------|----------|------|
| **Vercel Cron** | daily 12:00 UTC | `/api/cron` |
| **GitHub Actions** | every 15 min | `.github/workflows/catalog-cron.yml` |

Set the same `CRON_SECRET` on Vercel (env) and GitHub Actions (secret) to lock the endpoint. Until set, the route stays open for smoke tests.

Manual:

```bash
curl -sS "https://YOUR-BOARD.vercel.app/api/cron" | jq .
```

### Securing `/api/cron`

Production **fails closed** without `CRON_SECRET` (HTTP 503).

1. Generate: `openssl rand -hex 32`
2. Vercel → Project → Settings → Environment Variables → **Production** → `CRON_SECRET`
3. GitHub → Settings → Secrets and variables → Actions → `CRON_SECRET` (same value)
4. Redeploy

Callers must send `Authorization: Bearer <CRON_SECRET>` (or `X-Cron-Secret`). Query-string secrets are rejected.

## Health

```bash
curl -sS https://BOARD.vercel.app/api/health | jq .
curl -sS https://BOARD.vercel.app/api/health?deep=1 | jq .
```

- Shallow: app + config (no agency network)
- Deep: also probes primary agencies
- HTTP 200 = ok / degraded; 503 = unhealthy (core config missing)

### Automated health (GitHub Actions)

Workflow **Health check** runs every 15 minutes against production `/api/health`.

- Manual: Actions → Health check → Run workflow (`deep` optional)
- Degraded status warns but does not fail (unless `fail_on_degraded`)
- Unhealthy / HTTP 503 fails the job
