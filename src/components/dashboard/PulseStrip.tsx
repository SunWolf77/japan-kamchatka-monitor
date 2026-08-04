import type { ContinuumReport } from "@/lib/supt/continuum";
import type { SwarmIntensity } from "@/lib/seismic/intensity";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  continuum: ContinuumReport;
  intensity: SwarmIntensity;
  newSincePoll: number;
  rate6h: number;
  className?: string;
};

function energyWord(eii: number, rpam: string): string {
  if (rpam === "ACTIVE" || eii >= 0.85) return "High";
  if (rpam === "ELEVATED" || eii >= 0.6) return "Elev.";
  if (eii >= 0.35) return "Mod.";
  return "Base";
}

function phaseWord(rpam: string): string {
  if (rpam === "ACTIVE") return "High load";
  if (rpam === "ELEVATED") return "Elevated";
  return "Watching";
}

/** Compact global pulse — plain labels, scan-friendly. */
export function PulseStrip({
  continuum: C,
  intensity,
  newSincePoll,
  rate6h,
  className,
}: Props) {
  return (
    <div
      className={cn("flex items-center gap-1 overflow-x-auto text-[11px]", className)}
      role="status"
      aria-label="Live pulse strip"
    >
      <Pill
        label="Energy"
        value={energyWord(C.eii, C.rpam)}
        title={`Energy load index ${C.eii.toFixed(2)} · ${C.rpam}`}
        tone={C.eii >= 0.85 ? "critical" : C.eii >= 0.6 ? "warn" : "muted"}
      />
      <Pill
        label="Phase"
        value={phaseWord(C.rpam)}
        title={`RPAM ${C.rpam}`}
        tone={
          C.rpam === "ACTIVE" ? "critical" : C.rpam === "ELEVATED" ? "warn" : "muted"
        }
      />
      <Pill
        label="SR"
        value={String(C.schumannIndex || "—")}
        title="Schumann resonance index"
        tone={C.schumannIndex >= 70 ? "warn" : "muted"}
        mono
      />
      <Pill
        label="Swarm"
        value={intensity.level}
        title={intensity.note}
        tone={
          intensity.tone === "critical"
            ? "critical"
            : intensity.tone === "warn"
              ? "warn"
              : intensity.tone === "accent"
                ? "accent"
                : "muted"
        }
      />
      <Pill
        label="6h"
        value={String(rate6h)}
        title="Events in last 6 hours"
        mono
        tone="muted"
      />
      {newSincePoll > 0 && (
        <Badge variant="outline" className="h-5 shrink-0 px-1.5 font-mono text-[10px]">
          +{newSincePoll}
        </Badge>
      )}
      <span
        className="ml-auto hidden shrink-0 font-mono text-[10px] text-muted-foreground xl:inline"
        title="Geomagnetic Kp"
      >
        Kp {C.kp.toFixed(1)}
      </span>
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
  mono,
  title,
}: {
  label: string;
  value: string;
  tone: "muted" | "accent" | "warn" | "critical";
  mono?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded border px-1.5 text-[10px] leading-none",
        mono && "font-mono tabular-nums",
        tone === "critical" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
        tone === "accent" && "border-accent/40 bg-accent/10 text-accent",
        tone === "muted" && "border-border bg-card text-foreground",
      )}
    >
      <span className="text-[9px] font-medium uppercase tracking-wide opacity-60">{label}</span>
      <span className={cn("font-semibold", mono && "font-mono tabular-nums")}>{value}</span>
    </span>
  );
}
