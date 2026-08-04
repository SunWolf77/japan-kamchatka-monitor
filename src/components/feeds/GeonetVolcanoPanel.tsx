import { useEffect, useState } from "react";
import { Mountain } from "lucide-react";
import { fetchGeonetVal } from "@/lib/supt/earthFeedsServer";
import {
  type GeonetValSnapshot,
  emptyGeonet,
  accTone,
} from "@/lib/seismic/geonet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  /** When true, expand full NZ list; default shows Kermadec + elevated */
  expanded?: boolean;
  className?: string;
};

export function GeonetVolcanoPanel({ expanded = false, className }: Props) {
  const [snap, setSnap] = useState<GeonetValSnapshot>(emptyGeonet());

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchGeonetVal().then((s) => {
        if (!cancelled) setSnap(s);
      });
    };
    load();
    const id = window.setInterval(load, 300_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const k = snap.kermadec;
  const arc = snap.volcanoes.filter((v) => v.isKermadecArc);
  const list = expanded
    ? [...snap.volcanoes].sort((a, b) => b.level - a.level || a.title.localeCompare(b.title))
    : [
        ...(k ? [k] : []),
        ...snap.elevated.filter((v) => v.id !== "kermadecislands"),
        ...arc.filter(
          (v) =>
            v.id !== "kermadecislands" &&
            !snap.elevated.some((e) => e.id === v.id),
        ),
      ].slice(0, 8);

  return (
    <Card className={cn("border-warn/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Mountain className="size-4 text-warn" />
          <CardTitle className="text-sm">GeoNet volcanic status</CardTitle>
          {k && (
            <Badge
              variant={
                accTone(k.acc) === "critical"
                  ? "critical"
                  : accTone(k.acc) === "warn"
                    ? "warn"
                    : "outline"
              }
            >
              Kermadec · {k.acc} · VAL {k.level}
            </Badge>
          )}
        </div>
        <CardDescription>
          Live{" "}
          <a
            className="text-accent hover:underline"
            href="https://api.geonet.org.nz/volcano/val"
            target="_blank"
            rel="noopener noreferrer"
          >
            api.geonet.org.nz/volcano/val
          </a>
          . Official NZ/Kermadec arc alerts — Hunga Tonga itself is outside GeoNet mandate;
          <strong className="font-medium text-foreground"> Kermadec Islands</strong> is the
          direct subduction-volcano entry for this SES node.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {snap.error && (
          <p className="text-destructive">GeoNet: {snap.error}</p>
        )}
        {list.length === 0 && !snap.error && (
          <p className="text-muted-foreground">Loading GeoNet VAL…</p>
        )}
        {list.map((v) => (
          <div
            key={v.id}
            className={cn(
              "rounded-lg border px-2.5 py-2",
              v.id === "kermadecislands"
                ? "border-accent/40 bg-accent/5"
                : "border-border bg-secondary/30",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{v.title}</span>
              <Badge
                variant={
                  accTone(v.acc) === "critical"
                    ? "critical"
                    : accTone(v.acc) === "warn"
                      ? "warn"
                      : "outline"
                }
              >
                {v.acc}
              </Badge>
              <span className="font-mono tabular-nums text-muted-foreground">
                VAL {v.level}
              </span>
              {v.id === "kermadecislands" && (
                <Badge variant="live">TK node</Badge>
              )}
            </div>
            {v.activity && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {v.activity}
              </p>
            )}
          </div>
        ))}
        <a
          href="https://www.geonet.org.nz/volcano"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[11px] text-accent hover:underline"
        >
          GeoNet volcano page ↗
        </a>
      </CardContent>
    </Card>
  );
}
