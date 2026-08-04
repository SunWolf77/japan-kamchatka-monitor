/** Canonical public URL for Open Graph / X cards. */
export const SITE_URL =
  (typeof process !== "undefined" &&
    (process.env.SITE_URL || process.env.VITE_SITE_URL)?.replace(/\/$/, "")) ||
  "https://japan-kamchatka-monitor.vercel.app";

export const SITE_NAME = "Japan–Kamchatka Monitor";
export const SITE_TITLE = "Japan–Kamchatka Monitor · Sun-Earth-Sentinel";

/** Keep under ~200 chars for X card body. */
export const SITE_DESCRIPTION =
  "Live Japan Arc + Kamchatka–Kurils seismic, volcano & tsunami monitor (JMA Bosai + USGS) — SUPT Continuum. Sun-Earth-Sentinel focus node #3. Not a forecast.";

/**
 * Absolute OG image. Bump CARD_VERSION whenever art or tags change so X
 * treats the image URL as new (card cache cannot be purged via API).
 */
export const CARD_VERSION = "20260804a";

export const OG_IMAGE = `${SITE_URL}/og-card-v2.png?v=${CARD_VERSION}`;

export const TWITTER_HANDLE = "@Sunwolf77";
