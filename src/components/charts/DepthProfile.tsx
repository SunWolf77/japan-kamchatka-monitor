import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import { depthHistogram } from "@/lib/seismic/swarm";
import { magColor } from "@/lib/seismic/colors";
import { formatDateTime, formatMag, magValue } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  events: QuakeEvent[];
  node: FocusNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function CrossSection({
  events,
  axis,
  node,
  selectedId,
  onSelect,
}: {
  events: QuakeEvent[];
  axis: "lon" | "lat";
  node: FocusNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const data = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        x: axis === "lon" ? e.longitude : e.latitude,
        depth: e.depthKm,
        mag: magValue(e.magnitude),
        time: e.time,
        place: e.place,
      })),
    [events, axis],
  );

  const maxDepth = useMemo(() => {
    if (events.length === 0) return Math.max(node.depthRangeKm.deep, 5);
    const d = Math.max(...events.map((e) => e.depthKm), 1);
    // Headroom so markers are not clipped; keep CF views tight
    return Math.max(Math.ceil(d * 1.35 * 2) / 2, 3);
  }, [events, node.depthRangeKm.deep]);

  const xLabel = axis === "lon" ? "Longitude (E)" : "Latitude (N)";
  const domain =
    axis === "lon"
      ? [node.bbox.minLon, node.bbox.maxLon]
      : [node.bbox.minLat, node.bbox.maxLat];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={domain as [number, number]}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            tickFormatter={(v: number) => v.toFixed(2)}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -2,
              fill: "var(--color-muted-foreground)",
              fontSize: 10,
            }}
          />
          <YAxis
            type="number"
            dataKey="depth"
            name="Depth"
            reversed
            domain={[0, maxDepth]}
            allowDataOverflow
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
            label={{
              value: "Depth (km)",
              angle: -90,
              position: "insideLeft",
              fill: "var(--color-muted-foreground)",
              fontSize: 10,
            }}
          />
          <ZAxis type="number" dataKey="mag" range={[40, 300]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as
                | { mag: number; depth: number; time: number; place: string; x: number }
                | undefined;
              if (!p) return null;
              return (
                <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                  <div className="font-mono font-semibold">M{formatMag(p.mag)}</div>
                  <div className="text-muted-foreground">
                    {p.depth.toFixed(1)} km ·{" "}
                    {axis === "lon" ? `${p.x.toFixed(3)} E` : `${p.x.toFixed(3)} N`}
                  </div>
                  <div className="text-muted-foreground">{formatDateTime(p.time)}</div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            onClick={(d) => {
              const id = (d as { id?: string }).id;
              if (id) onSelect?.(id);
            }}
          >
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={magColor(d.mag)}
                fillOpacity={selectedId && selectedId !== d.id ? 0.35 : 0.85}
                stroke={selectedId === d.id ? "var(--color-fg)" : "transparent"}
                strokeWidth={selectedId === d.id ? 1.5 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepthProfile({ events, node, selectedId, onSelect }: Props) {
  const hist = useMemo(() => depthHistogram(events, 0.5), [events]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Depth cross-section — longitude</CardTitle>
          <CardDescription>
            Hypocenters projected E–W. Depth positive down; marker size scales with magnitude.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrossSection
            events={events}
            axis="lon"
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Depth cross-section — latitude</CardTitle>
          <CardDescription>
            Hypocenters projected N–S. Shallow CF events typically under 4 km.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrossSection
            events={events}
            axis="lat"
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Depth distribution</CardTitle>
          <CardDescription>
            Event count by depth bin (0.5 km). Bar colour = mean magnitude in that bin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <MagColorLegend />
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="var(--color-chart-grid)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as
                      | { label: string; count: number; meanMag: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{p.label} km</div>
                        <div className="text-muted-foreground">
                          {p.count} events · mean M{formatMag(p.meanMag)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {hist.map((b) => (
                    <Cell key={b.label} fill={magColor(b.meanMag || 1)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Matches magColor() thresholds — cool micro → warm critical. */
const MAG_LEGEND: { label: string; mag: number }[] = [
  { label: "<1.5", mag: 1.0 },
  { label: "1.5+", mag: 1.5 },
  { label: "2.5+", mag: 2.5 },
  { label: "3.5+", mag: 3.5 },
  { label: "4.5+", mag: 4.5 },
];

function MagColorLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground"
      aria-label="Mean magnitude colour scale"
    >
      <span className="shrink-0 font-medium text-foreground/80">Mean M</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {MAG_LEGEND.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2.5 shrink-0 rounded-sm ring-1 ring-border/60"
              style={{ background: magColor(s.mag) }}
              aria-hidden
            />
            <span className="font-mono">{s.label}</span>
          </span>
        ))}
      </div>
      <span className="text-[9px] opacity-70">cool → warm</span>
    </div>
  );
}
