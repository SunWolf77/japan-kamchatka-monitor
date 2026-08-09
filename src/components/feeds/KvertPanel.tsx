/**
 * KVERT aviation colour codes — Kamchatka–Kurils authority.
 */

import { useEffect, useState } from "react";
import { ExternalLink, Mountain } from "lucide-react";
import {
  KVERT_ABOUT,
  KVERT_COLOR_LEGEND,
  KVERT_WEEKLY_URL,
  badgeVariantForColour,
  colourHex,
  emptyKvert,
  type KvertSnapshot,
} from "@/lib/seismic/kvert";
import { fetchKvertAlerts } from "@/lib/seismic/kvertServer";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";

type Props = {
  compact?: boolean;
  className?: string;
};

export function KvertPanel({ compact = false, className }: Props) {
  const [snap, setSnap] = useState<KvertSnapshot>(() => emptyKvert());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchKvertAlerts();
        if (!cancelled) setSnap(data);
      } catch (e) {
        if (!cancelled)
          setSnap(emptyKvert(e instanceof Error ? e.message : "fetch failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const elevated = snap.elevated;
  const top = elevated[0];

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs",
          className,
        )}
      >
        <Mountain className="h-3.5 w-3.5 text-orange-500" />
        <span className="font-medium text-muted-foreground">KVERT</span>
        {loading ? (
          <span className="text-muted-foreground">…</span>
        ) : elevated.length === 0 ? (
          <Badge variant="outline" className="text-[10px]">
            all green / quiet
          </Badge>
        ) : (
          elevated.slice(0, 4).map((v) => (
            <Badge
              key={v.nameRaw}
              variant={badgeVariantForColour(v.colour)}
              className="text-[10px]"
              style={{ borderColor: colourHex(v.colour) }}
            >
              {v.name} {v.colour}
            </Badge>
          ))
        )}
        {snap.dailyUrl && (
          <a
            href={snap.dailyUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mountain className="h-4 w-4 text-orange-500" />
              KVERT · Kamchatka–Kurils
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              IVS FEB RAS · ICAO aviation colour · authority for this arc. Not
              USGS.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground">
            {snap.reportId && <span>#{snap.reportId}</span>}
            <span>{formatRelativeTime(snap.fetchedAt)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {snap.error && (
          <p className="text-xs text-destructive">{snap.error}</p>
        )}
        {loading && (
          <p className="text-xs text-muted-foreground">Loading KVERT…</p>
        )}
        {!loading && elevated.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No elevated (YELLOW / ORANGE / RED) volcanoes in the latest daily
            report.
          </p>
        )}
        {elevated.map((v) => (
          <div
            key={v.nameRaw}
            className="rounded-md border border-border/50 bg-muted/20 p-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{v.name}</span>
              <Badge
                variant={badgeVariantForColour(v.colour)}
                style={{ borderColor: colourHex(v.colour) }}
              >
                {v.colour}
              </Badge>
              {v.region && (
                <span className="text-[10px] text-muted-foreground">
                  {v.region}
                </span>
              )}
              {v.cavw && (
                <span className="text-[10px] text-muted-foreground">
                  CAVW #{v.cavw}
                </span>
              )}
            </div>
            {v.synopsis && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {v.synopsis}
              </p>
            )}
            {v.href && (
              <a
                href={v.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                volcano page <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-3 border-t border-border/40 pt-2 text-[11px]">
          <a
            href={KVERT_WEEKLY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            Weekly release
          </a>
          <a
            href={KVERT_COLOR_LEGEND}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            Colour legend
          </a>
          <a
            href={KVERT_ABOUT}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            About KVERT
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground">{snap.note}</p>
      </CardContent>
    </Card>
  );
}
