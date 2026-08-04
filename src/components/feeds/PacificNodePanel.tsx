import { Waves } from "lucide-react";
import { PACIFIC_NODES } from "@/lib/supt/pacificNodes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PacificNodePanel({ className }: { className?: string }) {
  return (
    <Card className={cn("border-warn/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Waves className="size-4 text-warn" />
          <CardTitle className="text-sm">Pacific submarine / arc nodes</CardTitle>
          <Badge variant="outline">{PACIFIC_NODES.length} nodes</Badge>
        </div>
        <CardDescription>
          Registry from Notion Pacific NODE_07-05, Tokara SitRep, Hunga 2022 pathway, GeoNet
          Kermadec VAL, and SES Tonga–Kermadec. USGS/GeoNet authority only — never dual-read with
          Campi Flegrei INGV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {PACIFIC_NODES.map((n) => (
          <div
            key={n.id}
            className={cn(
              "rounded-lg border px-2.5 py-2",
              n.id === "tonga-kermadec"
                ? "border-accent/40 bg-accent/5"
                : "border-border bg-secondary/25",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{n.name}</span>
              <Badge variant="outline" className="uppercase">
                {n.authority}
              </Badge>
              {n.id === "tonga-kermadec" && <Badge variant="live">SES #1</Badge>}
              {n.id === "south-japan-pacific" && <Badge variant="warn">07-05</Badge>}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{n.role}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{n.notes}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {n.tags.map((t) => (
                <span
                  key={t}
                  className="rounded border border-border px-1 py-0.5 text-[9px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              {n.center.lat.toFixed(2)}°, {n.center.lon.toFixed(2)}° · {n.region}
            </p>
            {n.notionHref && (
              <a
                href={n.notionHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[11px] text-accent hover:underline"
              >
                Source notes ↗
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
