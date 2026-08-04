import { useEffect, useState } from "react";
import { Radio, AlertTriangle } from "lucide-react";
import {
  fetchSchumann,
  fetchTomskChartDataUrl,
} from "@/lib/supt/earthFeedsServer";
import {
  type SchumannSnapshot,
  emptySchumann,
  schumannTone,
  RESONANCEONE_HOME,
} from "@/lib/supt/schumann";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SchumannPanel({ className }: { className?: string }) {
  const [snap, setSnap] = useState<SchumannSnapshot>(emptySchumann());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchSchumann().then((s) => {
        if (!cancelled) setSnap(s);
      });
    };
    load();
    const id = window.setInterval(load, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const tone = schumannTone(snap.schumannIndex);

  return (
    <Card className={cn("border-accent/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Radio className="size-4 text-accent" />
          <CardTitle className="text-sm">Schumann resonance · Tomsk</CardTitle>
          <Badge
            variant={
              tone === "critical"
                ? "critical"
                : tone === "warn"
                  ? "warn"
                  : tone === "accent"
                    ? "live"
                    : "outline"
            }
          >
            SR index {snap.schumannIndex}
          </Badge>
          <Badge
            variant={
              snap.tomskOrigin === "ok"
                ? "outline"
                : snap.tomskOrigin === "down"
                  ? "warn"
                  : "secondary"
            }
            className="text-[10px]"
            title="Server-side probe of sosrff.tsu.ru"
          >
            SOSRFF {snap.tomskOrigin}
          </Badge>
        </div>
        <CardDescription>
          Numbers from ResonanceOne (Tomsk-attributed). Charts load through this app’s proxy so
          browser DNS failures to sosrff.tsu.ru do not blank the panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {(snap.tomskOrigin === "down" || snap.error) && (
          <div className="flex items-start gap-2 rounded-md border border-warn/35 bg-warn/10 px-2.5 py-2 text-warn">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <div className="min-w-0 leading-relaxed">
              {snap.tomskOrigin === "down" && (
                <p>
                  Tomsk SOSRFF origin is unreachable from the server (DNS/network). Direct browser
                  links to tsu.ru will fail. EII still uses ResonanceOne SR index when available.
                </p>
              )}
              {snap.error && <p className="mt-1 text-destructive">{snap.error}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini k="Activity" v={String(snap.activityIndex)} h={snap.activityLabel} />
          <Mini k="SR freq" v={`${snap.frequencyHz.toFixed(2)} Hz`} h="fundamental" />
          <Mini k="Factor" v={snap.schumannFactor.toFixed(2)} h="SUPT scale" />
          <Mini k="Kp (feed)" v={String(snap.kpIndex)} h={snap.kpLabel} />
        </div>

        {snap.summary && (
          <p className="rounded-md border border-border bg-secondary/40 p-2.5 leading-relaxed text-muted-foreground">
            {snap.summary}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <ChartThumb file="sra.jpg" label="Amplitude (sra)" />
          <ChartThumb file="fc_fsr1.jpg" label="Spectrogram (fc_fsr1)" />
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">{snap.tomskNote}</p>

        <div className="flex flex-wrap gap-2 text-[10px]">
          <a
            className="text-accent hover:underline"
            href={RESONANCEONE_HOME}
            target="_blank"
            rel="noopener noreferrer"
          >
            ResonanceOne ↗
          </a>
          {snap.updatedAt && (
            <span className="font-mono text-muted-foreground">
              {new Date(snap.updatedAt).toISOString().slice(0, 16)}Z
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ k, v, h }: { k: string; v: string; h: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{h}</div>
    </div>
  );
}

/**
 * Load chart: try same-origin /api/tomsk first; fall back to server-fn data URL
 * if the API route is not registered yet.
 */
function ChartThumb({ file, label }: { file: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bust = Math.floor(Date.now() / 120_000);
    const proxy = `/api/tomsk?file=${encodeURIComponent(file)}&t=${bust}`;

    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setSrc(proxy);
        setFailed(false);
      }
    };
    img.onerror = () => {
      // Fallback: server function → base64 (works without HTTP route)
      void fetchTomskChartDataUrl({ data: { file } }).then((r) => {
        if (cancelled) return;
        if (r.dataUrl) {
          setSrc(r.dataUrl);
          setFailed(false);
        } else {
          setFailed(true);
        }
      });
    };
    img.src = proxy;

    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/20">
      <div className="border-b border-border px-2 py-1 text-[10px] text-muted-foreground">
        {label} · proxy
      </div>
      {failed || !src ? (
        <div className="flex h-36 flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-muted-foreground">
          <span>{failed ? "Chart unavailable" : "Loading chart…"}</span>
          <span className="text-[10px] opacity-80">
            Not loaded from your browser → tsu.ru (DNS bypass)
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={label}
          className="h-36 w-full object-cover object-top"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
