/**
 * USGS HANS elevated volcanoes — AVO-first Pacific neighbor (not KVERT).
 */

import { useEffect, useState } from "react";
import { ExternalLink, Mountain } from "lucide-react";
import {
  USGS_VHP_UPDATES_URL,
  badgeVariantForColor,
  colorHex,
  emptyUsgsVolcano,
  type UsgsVolcanoSnapshot,
} from "@/lib/seismic/usgsVolcano";
import { fetchUsgsVolcanoAlerts } from "@/lib/seismic/usgsVolcanoServer";
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
  avoFirst?: boolean;
  compact?: boolean;
  className?: string;
};

export function UsgsVolcanoPanel({
  avoFirst = true,
  compact = false,
  className,
}: Props) {
  const [snap, setSnap] = useState<UsgsVolcanoSnapshot>(() =>
    emptyUsgsVolcano(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchUsgsVolcanoAlerts();
        if (!cancelled) setSnap(data);
      } catch (e) {
        if (!cancelled)
          setSnap(
            emptyUsgsVolcano(e instanceof Error ? e.message : "fetch failed"),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = avoFirst
    ? [...snap.avo, ...snap.elevated.filter((v) => !v.isAvo)]
    : snap.elevated;
  const shown = list.slice(0, compact ? 4 : 12);

  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs",
          className,
        )}
      >
        <Mountain className="h-3.5 w-3.5 text-sky-500" />
        <span className="font-medium text-muted-foreground">USGS HANS</span>
        {loading ? (
          <span className="text-muted-foreground">…</span>
        ) : shown.length === 0 ? (
          <Badge variant="outline" className="text-[10px]">
            no elevated U.S.
          </Badge>
        ) : (
          shown.map((v) => (
            <Badge
              key={v.id}
              variant={badgeVariantForColor(v.colorCode)}
              className="text-[10px]"
              style={{ borderColor: colorHex(v.colorCode) }}
            >
              {v.name} {v.colorCode}
            </Badge>
          ))
        )}
        <a
          href={USGS_VHP_UPDATES_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mountain className="h-4 w-4 text-sky-500" />
              USGS HANS · U.S. / AVO
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Elevated U.S. volcanoes · AVO Aleutians primary. Not KVERT
              (Kamchatka authority is KVERT).
            </CardDescription>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(snap.fetchedAt)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {snap.error && (
          <p className="text-xs text-destructive">{snap.error}</p>
        )}
        {loading && (
          <p className="text-xs text-muted-foreground">Loading USGS…</p>
        )}
        {!loading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No elevated U.S. volcanoes in HANS/VSC feed.
          </p>
        )}
        {shown.map((v) => (
          <div
            key={v.id}
            className="rounded-md border border-border/50 bg-muted/20 p-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{v.name}</span>
              <Badge
                variant={badgeVariantForColor(v.colorCode)}
                style={{ borderColor: colorHex(v.colorCode) }}
              >
                {v.colorCode}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {v.alertLevel}
              </Badge>
              {v.isAvo && (
                <span className="text-[10px] text-sky-600">AVO</span>
              )}
            </div>
            {v.synopsis && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {v.synopsis}
              </p>
            )}
            {v.noticeUrl && (
              <a
                href={v.noticeUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                notice <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
        <a
          href={USGS_VHP_UPDATES_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          USGS volcano updates <ExternalLink className="h-3 w-3" />
        </a>
        <p className="text-[10px] text-muted-foreground">{snap.note}</p>
      </CardContent>
    </Card>
  );
}
