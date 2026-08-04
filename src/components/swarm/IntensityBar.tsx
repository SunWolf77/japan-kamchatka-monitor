import type { SwarmIntensity } from "@/lib/seismic/intensity";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  intensity: SwarmIntensity;
  className?: string;
};

export function IntensityBar({ intensity, className }: Props) {
  const pct = Math.min(
    100,
    Math.round((intensity.ratePerHour6h / Math.max(intensity.ratePerHour6h, 20)) * 100) ||
      Math.min(100, intensity.ratePerHour6h * 8),
  );

  // Scale bar against "Intense" roughly
  const bar =
    intensity.level === "Intense"
      ? 100
      : intensity.level === "High"
        ? 78
        : intensity.level === "Elevated"
          ? 55
          : intensity.level === "Low"
            ? 32
            : 12;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-2.5",
        intensity.tone === "critical" && "border-destructive/40 bg-destructive/5",
        intensity.tone === "warn" && "border-warn/35 bg-warn/5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Swarm intensity
          </span>
          <Badge
            variant={
              intensity.tone === "critical"
                ? "critical"
                : intensity.tone === "warn"
                  ? "warn"
                  : intensity.tone === "accent"
                    ? "live"
                    : "outline"
            }
          >
            {intensity.level}
          </Badge>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {intensity.ratePerHour6h.toFixed(1)}/h · 6h · {intensity.rate6h} evt · 1h{" "}
          {intensity.rate1h}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            intensity.tone === "critical" && "bg-destructive",
            intensity.tone === "warn" && "bg-warn",
            intensity.tone === "accent" && "bg-accent",
            intensity.tone === "muted" && "bg-muted-foreground/40",
          )}
          style={{ width: `${bar}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {intensity.note}
        <span className="sr-only"> bar {pct}</span>
      </p>
    </div>
  );
}
