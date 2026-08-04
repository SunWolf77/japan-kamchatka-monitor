# Debugging X (Twitter) link cards

## Status (server)

| Check | Expected | Live |
| --- | --- | --- |
| `twitter:card` | `summary_large_image` | SSR in `__root.tsx` |
| `twitter:image` / `og:image` | Absolute `https://…/og-card-v2.png?v=…` | `src/lib/seo.ts` |
| Image size | 1200×630 PNG, under 5 MB | `public/og-card-v2.png` |
| Twitterbot fetch | 200 HTML + 200 PNG | `curl -A Twitterbot/1.0` |

There is **no public API** to flush X card cache. Redeploy alone does **not** refresh a URL X already crawled.

## Why a share looked empty

1. First crawl happened **before** OG tags existed → X cached “no card”.
2. Composer preview uses that cache.
3. Card Validator is restricted / often won’t purge for free accounts.

## Force a re-scrape (what works)

### A. New page URL (best for posts)

Share with a **new query string** so X treats it as a new URL:

```text
https://campi-flegrei-monitor.vercel.app/?card=20260801b
```

App ignores the param; crawler re-reads meta + image.

### B. New image URL (already done in code)

Whenever art changes, bump `CARD_VERSION` in [`src/lib/seo.ts`](../src/lib/seo.ts):

```ts
export const CARD_VERSION = "20260801b"; // bump → 20260801c
```

Image becomes `…/og-card-v2.png?v=NEW` — X has no prior cache for that image URI.

### C. Card Validator (if available)

[cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) — paste URL → Preview. Often login-walled; not required if A works.

### D. Wait

Natural re-crawl is irregular (hours → ~7 days). Don’t rely on this for launches.

## Verify before posting

```bash
# Tags X sees
curl -sL -A "Twitterbot/1.0" "https://campi-flegrei-monitor.vercel.app/" \
  | grep -oE '<meta[^>]+(twitter|og)[^>]+>'

# Image reachable
curl -sI -A "Twitterbot/1.0" \
  "https://campi-flegrei-monitor.vercel.app/og-card-v2.png?v=20260801b"
```

Or opengraph debuggers (Facebook Sharing Debugger also fetches OG tags).

## Post checklist

1. Deploy finished (Vercel green).
2. Open `/og-card-v2.png` in browser — art loads.
3. Post **`https://campi-flegrei-monitor.vercel.app/?card=20260801b`** (or newer version).
4. Do not re-edit an old tweet expecting the card to update — post a **new** tweet/reply.

## Optional env

```text
SITE_URL=https://campi-flegrei-monitor.vercel.app
```

Must match the domain you share (custom domain → set this and rebuild).
