import { useEffect, useState } from "react";
import { AlertTriangle, Waves, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuakeEvent } from "@/lib/seismic/types";
import {
  fetchJmaTsunami,
  potentialTsunamiSources,
  statusLabel,
  statusTone,
  type TsunamiWatchSnapshot,
} from "@/lib/seismic/tsunami";
import { cn, formatDateTime, formatMag, formatRelativeTime } from "@/lib/utils";

type Props = {
  events: QuakeEvent[];
  className?: string;
};

export function TsunamiPanel({ events, className }: Props) {
  const [snap, setSnap] = useState<TsunamiWatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const s = await fetchJmaTsunami();
    setSnap(s);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, []);

  const sources = potentialTsunamiSources(events);
  const highest = snap?.highest ?? "none";
  const tone = statusTone(highest);

  return (
    <div className={cn("space-y-3", className)}>
      <Card className="border-border/80 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Waves className="size-4 text-accent" />
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Tsunami watch</h3>
              <p className="text-[11px] text-muted-foreground">
                JMA VTSE bulletins · Pacific source candidates — not a warning service
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase tracking-wide",
                tone === "danger" && "border-danger/60 text-danger",
                tone === "warn" && "border-amber-400/60 text-amber-300",
                tone === "info" && "border-accent/50 text-accent",
              )}
            >
              {statusLabel(highest)}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => void load()}
              disabled={loading}
              title="Refresh tsunami list"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {snap?.error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1.5 text-xs text-danger">
              JMA tsunami feed: {snap.error}
            </p>
          )}

          {snap && snap.active.length === 0 && !snap.error && (
            <div className="flex items-start gap-2 rounded-md border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-success" />
              <span>
                No active JMA tsunami warning / advisory in the current list window. Always
                follow official JMA / PTWC / local civil protection.
              </span>
            </div>
          )}

          {snap && snap.active.length > 0 && (
            <ul className="space-y-2">
              {snap.active.map((b) => (
                <li
                  key={b.id}
                  className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{b.titleEn}</span>
                    <Badge variant="outline" className="text-[10px] text-danger">
                      {statusLabel(b.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {b.areaEn}
                    {b.mag != null ? ` · M${b.mag.toFixed(1)}` : ""}
                    {b.depthKm != null ? ` · ${b.depthKm.toFixed(0)} km` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDateTime(b.time)} · {formatRelativeTime(b.time)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href="https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=tsunami&lang=en"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              JMA tsunami map <ExternalLink className="size-3" />
            </a>
            <a
              href="https://www.tsunami.gov/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              PTWC / tsunami.gov <ExternalLink className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80">
        <CardHeader className="pb-2">
          <h3 className="text-sm font-semibold">Potential source events</h3>
          <p className="text-[11px] text-muted-foreground">
            Catalog M≥6 · depth ≤100 km · last 7d in current node window
          </p>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground">No M≥6 shallow candidates in view.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {sources.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-accent">
                      {formatMag(e.magnitude)}
                    </span>{" "}
                    <span className="text-foreground/90">{e.place}</span>
                    <div className="text-[10px] text-muted-foreground">
                      {e.depthKm.toFixed(0)} km · {formatRelativeTime(e.time)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {snap && snap.bulletins.length > 0 && (
        <Card className="border-border/80 bg-card/80">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Recent JMA tsunami bulletins</h3>
          </CardHeader>
          <CardContent>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
              {snap.bulletins.slice(0, 15).map((b) => (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-2 rounded border border-border/50 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground/90">{b.titleEn}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {b.areaEn} · {formatRelativeTime(b.time)}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {statusLabel(b.status)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
