import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
  Bar,
} from "recharts";
import type { QuakeEvent, SwarmAnalysis } from "@/lib/seismic/types";
import { magColor } from "@/lib/seismic/colors";
import { formatDateTime, formatMag, magValue } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { magnitudeHistogram } from "@/lib/seismic/swarm";

type Props = {
  events: QuakeEvent[];
  swarm: SwarmAnalysis;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function fmtHour(t: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(t));
}

export function TimelineCharts({ events, swarm, selectedId, onSelect }: Props) {
  const scatter = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        t: e.time,
        mag: magValue(e.magnitude),
        depth: e.depthKm,
      })),
    [events],
  );

  const rate = swarm.hourlyBins;
  const magHist = useMemo(() => magnitudeHistogram(events, 0.5), [events]);

  const depthTime = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        t: e.time,
        depth: e.depthKm,
        mag: magValue(e.magnitude),
      })),
    [events],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Magnitude timeline</CardTitle>
          <CardDescription>
            Each quake by origin time. Circle size ∝ magnitude — look for step-ups into the M4.7 sequence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="t"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => fmtHour(v as number)}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="mag"
                  name="M"
                  domain={[0, "auto"]}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                  label={{
                    value: "Magnitude",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--color-muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <ZAxis type="number" dataKey="mag" range={[40, 320]} />
                <Tooltip
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as
                      | { mag: number; depth: number; t: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        <div className="font-mono font-semibold">M{formatMag(p.mag)}</div>
                        <div className="text-muted-foreground">{p.depth.toFixed(1)} km</div>
                        <div className="text-muted-foreground">{formatDateTime(p.t)}</div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatter}
                  onClick={(d) => {
                    const id = (d as { id?: string }).id;
                    if (id) onSelect?.(id);
                  }}
                >
                  {scatter.map((d) => (
                    <Cell
                      key={d.id}
                      fill={magColor(d.mag)}
                      fillOpacity={selectedId && selectedId !== d.id ? 0.3 : 0.9}
                      stroke={selectedId === d.id ? "var(--color-fg)" : "transparent"}
                      strokeWidth={1.5}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event rate (hourly)</CardTitle>
          <CardDescription>
            Counts per hour with peak magnitude overlay — swarm pulses show as rate spikes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rate} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={(v) => fmtHour(v as number)}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="count"
                  allowDecimals={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="mag"
                  orientation="right"
                  domain={[0, "auto"]}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  content={({ payload, label }) => {
                    const p = payload?.[0]?.payload as
                      | { count: number; maxMag: number; meanDepth: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        <div className="font-medium">{fmtHour(label as number)}</div>
                        <div className="text-muted-foreground">
                          {p.count} events · max M{formatMag(p.maxMag)}
                        </div>
                        <div className="text-muted-foreground">
                          mean depth {p.meanDepth.toFixed(1)} km
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  fill="var(--color-chart-area)"
                  radius={[2, 2, 0, 0]}
                  opacity={0.85}
                />
                <Line
                  yAxisId="mag"
                  type="monotone"
                  dataKey="maxMag"
                  stroke="var(--color-mag-high)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Depth vs time</CardTitle>
          <CardDescription>
            Migration of hypocenters through the swarm — deepening or shallowing trends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="t"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v) => fmtHour(v as number)}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                />
                <YAxis
                  type="number"
                  dataKey="depth"
                  reversed
                  domain={[0, (dataMax: number) => Math.max(4, Math.ceil((Number(dataMax) || 1) * 1.4))]}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                  label={{
                    value: "Depth (km)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--color-muted-foreground)",
                    fontSize: 10,
                  }}
                />
                <ZAxis type="number" dataKey="mag" range={[30, 240]} />
                <Tooltip
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as
                      | { mag: number; depth: number; t: number }
                      | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        <div className="font-mono font-semibold">M{formatMag(p.mag)}</div>
                        <div className="text-muted-foreground">{p.depth.toFixed(1)} km</div>
                        <div className="text-muted-foreground">{formatDateTime(p.t)}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={depthTime} onClick={(d) => {
                  const id = (d as { id?: string }).id;
                  if (id) onSelect?.(id);
                }}>
                  {depthTime.map((d) => (
                    <Cell key={d.id} fill={magColor(d.mag)} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Magnitude–frequency</CardTitle>
          <CardDescription>
            Count per 0.5 magnitude bin (window catalog completeness depends on INGV local network).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={magHist} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="magFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-area)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-chart-area)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as { label: string; count: number } | undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
                        M {p.label}: {p.count}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-chart-line)"
                  fill="url(#magFill)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
