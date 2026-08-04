/**
 * Nitro production route — same-origin Tomsk chart proxy for Vercel.
 * GET /api/tomsk?file=sra.jpg
 */
import { defineEventHandler, getQuery, setHeader, send, createError } from "h3";
import { fetchTomskChart } from "../../../src/lib/supt/tomskProxy.server";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const file = typeof q.file === "string" ? q.file : "";
  const result = await fetchTomskChart(file);
  if (!result.ok) {
    throw createError({
      statusCode: result.status,
      statusMessage: result.message,
      data: { upstream: result.upstream },
    });
  }
  setHeader(event, "content-type", result.contentType);
  setHeader(
    event,
    "cache-control",
    "public, max-age=120, stale-while-revalidate=600",
  );
  setHeader(event, "access-control-allow-origin", "*");
  setHeader(event, "x-tomsk-upstream", result.upstream);
  setHeader(event, "x-proxy", "ses-tomsk");
  return send(event, Buffer.from(result.body));
});
