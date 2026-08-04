import { useMemo, useState } from "react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import { magColor, magRadius } from "@/lib/seismic/colors";
import { formatDateTime, formatDepth, formatMag, formatRelativeTime, magValue, cn } from "@/lib/utils";

type Props = {
  node: FocusNode;
  events: QuakeEvent[];
  selectedId?: string | null;
  onSelect?: (ev: QuakeEvent | null) => void;
  colorMode?: "magnitude" | "depth";
  className?: string;
};

function project(
  lon: number,
  lat: number,
  bbox: FocusNode["bbox"],
  w: number,
  h: number,
  pad = 16,
) {
  const x =
    pad + ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * (w - pad * 2);
  const y =
    pad + ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * (h - pad * 2);
  return { x, y };
}

function depthFill(depthKm: number, node: FocusNode): string {
  if (depthKm <= node.depthRangeKm.shallow) return "var(--color-depth-shallow)";
  if (depthKm >= node.depthRangeKm.deep) return "var(--color-depth-deep)";
  return "var(--color-depth-mid)";
}

export function EpicenterMap({
  node,
  events,
  selectedId,
  onSelect,
  colorMode = "magnitude",
  className,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const W = 720;
  const H = 480;

  const sorted = useMemo(
    () => [...events].sort((a, b) => magValue(a.magnitude) - magValue(b.magnitude)),
    [events],
  );

  const hover = events.find((e) => e.id === hoverId) ?? null;
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const tip = hover ?? selected;

  const outline = node.volcano?.outline;

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg bg-map", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        role="img"
        aria-label={`Epicenter map for ${node.name}`}
        onClick={() => onSelect?.(null)}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--color-map-grid)"
              strokeWidth="0.6"
            />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-mag-high)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-mag-high)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="var(--color-map-bg)" />
        <rect width={W} height={H} fill="url(#grid)" opacity={0.5} />

        {[0.25, 0.5, 0.75].map((t) => {
          const lon = node.bbox.minLon + t * (node.bbox.maxLon - node.bbox.minLon);
          const lat = node.bbox.minLat + t * (node.bbox.maxLat - node.bbox.minLat);
          const vx = project(lon, node.center.lat, node.bbox, W, H);
          const hy = project(node.center.lon, lat, node.bbox, W, H);
          return (
            <g key={t} className="text-map-label">
              <line
                x1={vx.x}
                y1={12}
                x2={vx.x}
                y2={H - 12}
                stroke="var(--color-map-grid)"
                strokeDasharray="2 6"
                opacity={0.4}
              />
              <line
                x1={12}
                y1={hy.y}
                x2={W - 12}
                y2={hy.y}
                stroke="var(--color-map-grid)"
                strokeDasharray="2 6"
                opacity={0.4}
              />
              <text
                x={vx.x + 4}
                y={H - 6}
                fill="var(--color-map-label)"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
              >
                {lon.toFixed(2)}E
              </text>
              <text
                x={8}
                y={hy.y - 4}
                fill="var(--color-map-label)"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
              >
                {lat.toFixed(2)}N
              </text>
            </g>
          );
        })}

        {outline && outline.length > 2 && (
          <path
            d={
              outline
                .map((pt, i) => {
                  const p = project(pt[0], pt[1], node.bbox, W, H);
                  return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
                })
                .join(" ") + " Z"
            }
            fill="var(--color-caldera-fill)"
            stroke="var(--color-caldera-stroke)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {(() => {
          const c = project(node.center.lon, node.center.lat, node.bbox, W, H);
          return (
            <g opacity={0.5}>
              <circle
                cx={c.x}
                cy={c.y}
                r={5}
                fill="none"
                stroke="var(--color-map-label)"
                strokeWidth={1}
              />
              <line
                x1={c.x - 10}
                y1={c.y}
                x2={c.x + 10}
                y2={c.y}
                stroke="var(--color-map-label)"
                strokeWidth={0.8}
              />
              <line
                x1={c.x}
                y1={c.y - 10}
                x2={c.x}
                y2={c.y + 10}
                stroke="var(--color-map-label)"
                strokeWidth={0.8}
              />
            </g>
          );
        })()}

        {sorted.map((ev) => {
          const { x, y } = project(ev.longitude, ev.latitude, node.bbox, W, H);
          const r = magRadius(ev.magnitude);
          const fill =
            colorMode === "depth" ? depthFill(ev.depthKm, node) : magColor(ev.magnitude);
          const isSel = ev.id === selectedId || ev.id === hoverId;
          const isBig = magValue(ev.magnitude) >= 4.0;

          return (
            <g
              key={ev.id}
              transform={`translate(${x},${y})`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(ev);
              }}
              onMouseEnter={() => setHoverId(ev.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {isBig && <circle r={r * 2.2} fill="url(#glow)" />}
              <circle
                r={r}
                fill={fill}
                fillOpacity={isSel ? 0.95 : 0.72}
                stroke={isSel ? "var(--color-fg)" : "var(--color-map-marker-stroke)"}
                strokeWidth={isSel ? 2 : 1}
              />
              {magValue(ev.magnitude) >= 3.5 && (
                <text
                  y={4}
                  textAnchor="middle"
                  fill="var(--color-fg)"
                  fontSize={9}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {magValue(ev.magnitude).toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tip && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:right-auto sm:max-w-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">
              M{formatMag(tip.magnitude)} {tip.magType}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeTime(tip.time)}
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>Depth {formatDepth(tip.depthKm)}</span>
            <span className="font-mono">
              {tip.latitude.toFixed(3)}N {tip.longitude.toFixed(3)}E
            </span>
            <span className="col-span-2">{tip.place}</span>
            <span className="col-span-2 font-mono text-[10px] opacity-80">
              {formatDateTime(tip.time)} · {tip.author}
            </span>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 rounded-md border border-border bg-card/90 px-2.5 py-2 text-[10px] text-muted-foreground backdrop-blur-sm">
        <div className="mb-1 font-medium text-foreground">
          {colorMode === "magnitude" ? "Magnitude" : "Depth"}
        </div>
        {colorMode === "magnitude" ? (
          <div className="flex flex-col gap-1">
            {[
              { m: "4.5+", c: "var(--color-mag-critical)" },
              { m: "3.5-4.4", c: "var(--color-mag-high)" },
              { m: "2.5-3.4", c: "var(--color-mag-mid)" },
              { m: "1.5-2.4", c: "var(--color-mag-low)" },
              { m: "under 1.5", c: "var(--color-mag-micro)" },
            ].map((row) => (
              <div key={row.m} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: row.c }} />
                <span className="font-mono">{row.m}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--color-depth-shallow)" }}
              />
              <span>to {node.depthRangeKm.shallow} km</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--color-depth-mid)" }}
              />
              <span>mid</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: "var(--color-depth-deep)" }}
              />
              <span>from {node.depthRangeKm.deep} km</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
