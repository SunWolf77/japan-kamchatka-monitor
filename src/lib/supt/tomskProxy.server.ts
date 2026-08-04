/**
 * Server-side Tomsk SOSRFF chart fetch (shared by Vite middleware + Nitro).
 */
import { isAllowedTomskFile, tomskUpstreamUrl } from "@/lib/supt/schumann";

export async function fetchTomskChart(
  file: string,
): Promise<
  | { ok: true; body: ArrayBuffer; contentType: string; upstream: string }
  | { ok: false; status: number; message: string; upstream?: string }
> {
  if (!isAllowedTomskFile(file)) {
    return {
      ok: false,
      status: 400,
      message: `Unknown chart file. Allowed: sra.jpg, fc_fsr1.jpg, …`,
    };
  }
  const upstream = tomskUpstreamUrl(file);
  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: "image/jpeg,image/*,*/*",
        "User-Agent": "SunEarthSentinel-CF-Monitor/1.0 (Tomsk chart proxy)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        message: `Tomsk upstream ${res.status}`,
        upstream,
      };
    }
    const body = await res.arrayBuffer();
    return {
      ok: true,
      body,
      contentType: res.headers.get("content-type") ?? "image/jpeg",
      upstream,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      message: err instanceof Error ? err.message : "Tomsk proxy failed",
      upstream,
    };
  }
}
