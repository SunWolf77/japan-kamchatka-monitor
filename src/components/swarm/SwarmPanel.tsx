import type { ComponentType } from "react";
import type { FocusNodeId, QuakeEvent, SwarmAnalysis, SwarmCluster } from "@/lib/seismic/types";
import { classifySwarmIntensity } from "@/lib/seismic/intensity";
import { formatDateTime, formatMag, formatRelativeTime, magValue, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntensityBar } from "@/components/swarm/IntensityBar";
import { Activity, Clock3, Layers, Radar, Zap } from "lucide-react";

type Props = {
  swarm: SwarmAnalysis;
  events: QuakeEvent[];
  nodeId: FocusNodeId;
  onSelectCluster?: (cluster: SwarmCluster) => void;
  onSelectEventId?: (id: string) => void;
  selectedEventId?: string | null;
  /** Events appeared since previous poll (Tonga monitor pattern). */
  newCount?: number;
};

function ClusterCard({
  cluster,
  onSelect,
  onSelectEventId,
  selectedEventId,
}: {
  cluster: SwarmCluster;
  onSelect?: (c: SwarmCluster) => void;
  onSelectEventId?: (id: string) => void;
  selectedEventId?: string | null;
}) {
  const chips = cluster.topEvents ?? [];
  return (
    <button
      type="button"
      onClick={() => onSelect?.(cluster)}
      className={cn(
        "w-full rounded-lg border border-border bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary",
        cluster.isActive && "border-warn/40 ring-1 ring-warn/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {cluster.isActive ? (
          <Badge variant="warn">Active swarm</Badge>
        ) : (
          <Badge variant="outline">Closed</Badge>
        )}
        <span className="font-mono text-sm font-semibold tabular-nums">
          max M{formatMag(cluster.maxMag)}
        </span>
        <span className="text-xs text-muted-foreground">
          {cluster.count} events · {cluster.ratePerHour.toFixed(1)}/h
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
        <span>Start {formatDateTime(cluster.start)}</span>
        <span>
          End {cluster.isActive ? formatRelativeTime(cluster.end) : formatDateTime(cluster.end)}
        </span>
        <span>
          Depth {cluster.depthRangeKm[0].toFixed(1)}–{cluster.depthRangeKm[1].toFixed(1)} km
          (med {cluster.medianDepthKm.toFixed(1)})
        </span>
        <span className="font-mono">
          {cluster.centroid.lat.toFixed(3)}°N {cluster.centroid.lon.toFixed(3)}°E
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...chips]
          .sort((a, b) => magValue(b.magnitude) - magValue(a.magnitude))
          .slice(0, 6)
          .map((e) => (
            <span
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectEventId?.(e.id);
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.stopPropagation();
                  onSelectEventId?.(e.id);
                }
              }}
              className={cn(
                "inline-flex items-center rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors hover:border-fg/30",
                selectedEventId === e.id && "border-fg/50 bg-muted",
              )}
            >
              M{formatMag(e.magnitude)} · {e.depthKm.toFixed(1)}km
            </span>
          ))}
        {cluster.count > chips.length && (
          <span className="self-center text-[10px] text-muted-foreground">
            +{cluster.count - chips.length} more
          </span>
        )}
      </div>
    </button>
  );
}

export function SwarmPanel({
  swarm,
  events,
  nodeId,
  onSelectCluster,
  onSelectEventId,
  selectedEventId,
  newCount = 0,
}: Props) {
  const active = swarm.active;
  const intensity = classifySwarmIntensity(swarm, events, nodeId);

  return (
    <div className="flex flex-col gap-3">
      <IntensityBar intensity={intensity} />

      {newCount > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <span className="font-medium text-accent">{newCount} new</span>
          <span className="text-muted-foreground"> since last poll</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Activity} label="1h rate" value={String(swarm.rate1h)} hint="events" />
        <Stat
          icon={Clock3}
          label="6h / 24h"
          value={`${swarm.rate6h} / ${swarm.rate24h}`}
          hint="events"
        />
        <Stat
          icon={Zap}
          label="Window max"
          value={`M${formatMag(swarm.maxMagWindow)}`}
          hint="largest"
          accent={swarm.maxMagWindow >= 4}
        />
        <Stat
          icon={Layers}
          label="Mean depth"
          value={`${swarm.meanDepthKm.toFixed(1)} km`}
          hint={`${(swarm.shallowFraction * 100).toFixed(0)}% < 3 km`}
        />
      </div>

      {active && (
        <Card className="border-warn/30 bg-warn/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radar className="size-4 text-warn" />
              Active swarm
            </CardTitle>
            <CardDescription>
              {active.count} events · peak M{formatMag(active.maxMagEvent.magnitude)} at{" "}
              {active.maxMagEvent.depthKm.toFixed(1)} km depth —{" "}
              {formatDateTime(active.maxMagEvent.time)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClusterCard
              cluster={active}
              onSelect={onSelectCluster}
              onSelectEventId={onSelectEventId}
              selectedEventId={selectedEventId}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detected clusters</CardTitle>
          <CardDescription>
            Groups of quakes close in time and place. Tap a group to open it on the map.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {swarm.clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No dense clusters in this window. Widen the time range or lower min magnitude.
            </p>
          ) : (
            swarm.clusters
              .filter((c) => !active || c.id !== active.id)
              .slice(0, 8)
              .map((c) => (
                <ClusterCard
                  key={c.id}
                  cluster={c}
                  onSelect={onSelectCluster}
                  onSelectEventId={onSelectEventId}
                  selectedEventId={selectedEventId}
                />
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-base font-semibold tabular-nums",
          accent && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
