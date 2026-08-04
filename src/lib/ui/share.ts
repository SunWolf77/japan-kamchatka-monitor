/**
 * Client share helpers — no third-party social SDKs.
 * Uses Web Share API when available; else clipboard + X intent URL.
 */

import { CARD_VERSION, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo";
import type { FocusNodeId } from "@/lib/seismic/types";
import type { WindowKey } from "@/lib/seismic/server";
import { sesDragonId } from "@/lib/seismic/ses-handoff";
import { nodeMonitorTitle } from "@/lib/seismic/branding";

export type ShareContext = {
  nodeId: FocusNodeId;
  windowKey: WindowKey;
  eii?: number;
  rpam?: string;
  rate6h?: number;
  eventCount?: number;
  largestMag?: number | null;
};

/** Canonical share URL with state + card cache-bust param. */
export function buildShareUrl(ctx: ShareContext, origin?: string): string {
  const base =
    (typeof window !== "undefined" && window.location?.origin) ||
    origin ||
    SITE_URL;
  const u = new URL(base.replace(/\/$/, "") + "/");
  u.searchParams.set("node", sesDragonId(ctx.nodeId));
  u.searchParams.set("window", ctx.windowKey);
  u.searchParams.set("card", CARD_VERSION);
  return u.toString();
}

export function buildShareText(ctx: ShareContext): string {
  const node = nodeMonitorTitle(ctx.nodeId);
  const bits: string[] = [`${node} · SES #3`];
  if (ctx.eii != null) bits.push(`EII ${ctx.eii.toFixed(2)}`);
  if (ctx.rpam) bits.push(ctx.rpam);
  if (ctx.rate6h != null) bits.push(`6h ${ctx.rate6h}`);
  if (ctx.largestMag != null && Number.isFinite(ctx.largestMag)) {
    bits.push(`peak M${ctx.largestMag.toFixed(1)}`);
  }
  if (ctx.eventCount != null) bits.push(`${ctx.eventCount} events`);
  bits.push("Not a forecast.");
  return bits.join(" · ");
}

/** X / Twitter web intent (no widget.js). */
export function xShareIntentUrl(url: string, text: string): string {
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  intent.searchParams.set("via", "Sunwolf77");
  return intent.toString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function nativeShare(opts: {
  title?: string;
  text: string;
  url: string;
}): Promise<"shared" | "cancelled" | "unavailable"> {
  if (!canNativeShare()) return "unavailable";
  try {
    await navigator.share({
      title: opts.title ?? SITE_TITLE,
      text: opts.text,
      url: opts.url,
    });
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    return "unavailable";
  }
}

export { SITE_DESCRIPTION, SITE_TITLE };
