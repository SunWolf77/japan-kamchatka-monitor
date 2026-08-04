import { Mountain, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FocusNodeId } from "@/lib/seismic/types";
import {
  volcanoAuthorityLabel,
  volcanoesForNode,
} from "@/lib/seismic/volcano-watch";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  className?: string;
};

export function VolcanoWatchPanel({ nodeId, className }: Props) {
  const list = volcanoesForNode(nodeId);
  const auth = volcanoAuthorityLabel(nodeId);

  return (
    <Card className={cn("border-border/80 bg-card/80", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Mountain className="size-4 text-amber-300" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Volcano watch</h3>
            <p className="text-[11px] text-muted-foreground">
              {auth} · static watchlist pins — open authority for live levels
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map((v) => (
            <li
              key={v.id}
              className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">{v.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {v.region}
                    {v.elevM != null ? ` · ${v.elevM} m` : ""}
                  </div>
                </div>
                <a
                  href={v.href}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-accent hover:underline"
                  title="Open authority page"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{v.note}</p>
              {v.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {v.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
