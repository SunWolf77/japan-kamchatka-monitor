import { LAIC_BRIEF } from "@/lib/supt/epochLog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Compact LAIC / Schumann science strip — progressive disclosure, not a third science dump. */
export function LaicBrief({ className, compact }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <details
        className={cn(
          "rounded-lg border border-border bg-secondary/20 text-[11px] leading-relaxed text-muted-foreground",
          className,
        )}
      >
        <summary className="cursor-pointer select-none px-2.5 py-2 font-medium text-foreground">
          LAIC & Schumann (science brief)
        </summary>
        <div className="space-y-2 border-t border-border px-2.5 py-2">
          <p>{LAIC_BRIEF.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {LAIC_BRIEF.layers.map((L) => (
              <span
                key={L.id}
                className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]"
                title={L.role}
              >
                {L.id} · {L.name}
              </span>
            ))}
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-[10px]">
            {LAIC_BRIEF.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </details>
    );
  }

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">{LAIC_BRIEF.title}</CardTitle>
          <Badge variant="outline">observational</Badge>
        </div>
        <CardDescription>{LAIC_BRIEF.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="grid gap-1.5 sm:grid-cols-3">
          {LAIC_BRIEF.layers.map((L) => (
            <div key={L.id} className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2">
              <div className="font-mono text-[10px] text-accent">{L.id}</div>
              <div className="font-medium">{L.name}</div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{L.role}</p>
            </div>
          ))}
        </div>
        <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
          {LAIC_BRIEF.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
