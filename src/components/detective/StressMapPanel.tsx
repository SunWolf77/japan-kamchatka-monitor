import { useEffect, useMemo, useState } from "react";
import { Crosshair, Info } from "lucide-react";
import type { FocusNode, QuakeEvent, SwarmAnalysis } from "@/lib/seismic/types";
import { runSwarmDetective } from "@/lib/supt/detective";
import { fetchSpaceWeather } from "@/lib/supt/kpServer";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import type { StressNode } from "@/lib/seismic/supt";
import { SuptMap } from "@/components/detective/SuptMap";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  events: QuakeEvent[];
  node: FocusNode;
  swarm: SwarmAnalysis;
  height: number;
  className?: string;
  /** Shared parent feeds — skips local poll when provided */
  spaceWeather?: SpaceWeatherSnapshot | null;
  schumannSnap?: SchumannSnapshot | null;
};

/**
 * Stress & fracture map — primary SUPT map surface.
 */
export function StressMapPanel({
  events,
  node,
  swarm,
  height,
  className,
  spaceWeather,
  schumannSnap,
}: Props) {
  const [localSw, setLocalSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [localSch, setLocalSch] = useState<SchumannSnapshot | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fs, setFs] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [nodeOpen, setNodeOpen] = useState(false);

  const useParentFeeds = spaceWeather !== undefined || schumannSnap !== undefined;
  const sw = spaceWeather !== undefined ? spaceWeather : localSw;
  const schumann = schumannSnap !== undefined ? schumannSnap : localSch;

  useEffect(() => {
    if (useParentFeeds) return;
    let cancelled = false;
    const load = () => {
      void fetchSpaceWeather().then((s) => {
        if (!cancelled) setLocalSw(s);
      });
      void fetchSchumann().then((s) => {
        if (!cancelled) setLocalSch(s);
      });
    };
    load();
    const id = window.setInterval(load, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [useParentFeeds]);

  const report = useMemo(
    () => runSwarmDetective(events, node, swarm, Date.now(), sw, schumann),
    [events, node, swarm, sw, schumann],
  );

  const top = report.fabric.stressNodes[0];
  const topPlane = report.fabric.planes[0];
  const selected: StressNode | null =
    report.fabric.stressNodes.find((n) => n.id === selectedNodeId) ?? null;

  // Prefer #1 selected quietly — card stays collapsed until user opens it
  useEffect(() => {
    if (!selectedNodeId && report.fabric.stressNodes[0]) {
      setSelectedNodeId(report.fabric.stressNodes[0].id);
    }
  }, [report.fabric.stressNodes, selectedNodeId]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {!fs && (
        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <Crosshair className="size-3.5 text-accent" />
          <span className="text-xs font-medium">Stress & fracture</span>
          <Badge variant="outline" className="h-5 font-mono text-[10px]">
            {report.fabric.stressNodes.length} nodes
          </Badge>
          <Badge variant="outline" className="h-5 font-mono text-[10px]">
            {report.fabric.planes.length} planes
          </Badge>
          {top && (
            <span className="font-mono text-[10px] text-muted-foreground">
              #1 score {top.score} · {top.depthKm.toFixed(1)} km · M{top.maxMag.toFixed(1)}
            </span>
          )}
          {topPlane && (
            <span className="font-mono text-[10px] text-muted-foreground">
              plane strike {topPlane.strikeDeg.toFixed(0)}° / dip {topPlane.dipDeg.toFixed(0)}°
            </span>
          )}
          <button
            type="button"
            onClick={() => setBriefOpen((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent"
          >
            <Info className="size-3" />
            {briefOpen ? "Hide reading" : "Reading"}
          </button>
        </div>
      )}

      {!fs && briefOpen && (
        <ObservationalBrief
          nodeName={node.name}
          topScore={top?.score}
          planeStrike={topPlane?.strikeDeg}
          planeDip={topPlane?.dipDeg}
          nNodes={report.fabric.stressNodes.length}
          nPlanes={report.fabric.planes.length}
          migrationAz={report.fabric.migration.length >= 2}
          eii={report.continuum.eii}
          rpam={report.continuum.rpam}
        />
      )}

            {!fs && selected && (
        <SelectedNodeCard
          sn={selected}
          open={nodeOpen}
          onToggle={() => setNodeOpen((v) => !v)}
          onClear={() => {
            setSelectedNodeId(null);
            setNodeOpen(false);
          }}
          peers={report.fabric.stressNodes}
          onPick={(id) => {
            setSelectedNodeId(id);
            setNodeOpen(true);
          }}
        />
      )}

      <div
        className={cn(!fs && "overflow-hidden rounded-lg border border-border")}
        style={!fs ? { height } : undefined}
      >
        <SuptMap
          node={node}
          events={events}
          planes={report.fabric.planes}
          stressNodes={report.fabric.stressNodes}
          lineaments={report.fabric.lineaments}
          migration={report.fabric.migration}
          stressField={report.fabric.stressField}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => {
            setSelectedNodeId(id);
            if (id) setNodeOpen(true);
          }}
          height={height}
          onFullscreenChange={setFs}
        />
      </div>
    </div>
  );
}

function SelectedNodeCard({
  sn,
  open,
  onToggle,
  onClear,
  peers,
  onPick,
}: {
  sn: StressNode;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  peers: StressNode[];
  onPick: (id: string) => void;
}) {
  const priority =
    sn.score >= 75 ? "HIGH" : sn.score >= 55 ? "MODERATE" : "SECONDARY";
  const near =
    sn.nearFractureId && sn.nearFractureDistKm != null
      ? `${sn.nearFractureDistKm.toFixed(2)} km from fitted plane`
      : "No close fracture plane nearby";

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-secondary/40"
        aria-expanded={open}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-[#ffb300] font-mono text-[10px] font-bold text-black">
          {sn.rank}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          Node #{sn.rank}
          <span className="ml-1.5 font-mono font-normal text-muted-foreground">
            {sn.score}/100 · {sn.depthKm.toFixed(1)} km · M{sn.maxMag.toFixed(1)} · n=
            {sn.eventCount}
          </span>
        </span>
        <Badge
          variant={
            sn.score >= 75 ? "critical" : sn.score >= 55 ? "warn" : "outline"
          }
          className="h-5 shrink-0 text-[9px]"
        >
          {priority}
        </Badge>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {open ? "Less" : "Details"}
        </span>
      </button>

      <div className={cn("ui-expand", open && "ui-expand-open")}>
        <div className="ui-expand-inner">
          <div className="border-t border-border px-3 py-2 text-[11px]">
            <p className="leading-relaxed text-foreground/90">{sn.interpretation}</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] sm:grid-cols-4">
              <Stat k="Depth" v={`${sn.depthKm.toFixed(2)} km`} />
              <Stat k="Events" v={String(sn.eventCount)} />
              <Stat k="Last 6h" v={String(sn.recentCount6h)} />
              <Stat k="Max M" v={`M${sn.maxMag.toFixed(1)}`} />
              <Stat k="Mean M" v={sn.meanMag.toFixed(2)} />
              <Stat k="Energy dens." v={sn.energyDensity.toFixed(2)} />
              <Stat k="Shallowness" v={`${(sn.shallowness * 100).toFixed(0)}%`} />
              <Stat
                k="Local b"
                v={sn.localBValue != null ? sn.localBValue.toFixed(2) : "—"}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {near} · {sn.location.lat.toFixed(4)}N {sn.location.lon.toFixed(4)}E
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {peers.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  className={cn(
                    "min-h-7 min-w-7 rounded-full border font-mono text-[10px] font-bold transition-transform active:scale-95",
                    p.id === sn.id
                      ? "border-foreground bg-[#ffb300] text-black"
                      : "border-border bg-card text-muted-foreground hover:border-accent",
                  )}
                >
                  {p.rank}
                </button>
              ))}
              <button
                type="button"
                onClick={onClear}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="font-semibold text-foreground">{v}</div>
    </div>
  );
}

function ObservationalBrief({
  nodeName,
  topScore,
  planeStrike,
  planeDip,
  nNodes,
  nPlanes,
  migrationAz,
  eii,
  rpam,
}: {
  nodeName: string;
  topScore?: number;
  planeStrike?: number;
  planeDip?: number;
  nNodes: number;
  nPlanes: number;
  migrationAz: boolean;
  eii: number;
  rpam: string;
}) {
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">
        What the map is showing · {nodeName} · not a forecast
      </p>
      <ul className="mt-1.5 list-inside list-disc space-y-1">
        <li>
          <span className="text-foreground">Amber discs</span> = ranked density/energy zones (
          {nNodes})
          {topScore != null ? ` — #1 scores ${topScore}/100` : ""}. Click a disc for full
          metrics (depth, rate, b-value, near-plane).
        </li>
        <li>
          <span className="text-foreground">Magenta lines</span> = PCA fracture planes (
          {nPlanes})
          {planeStrike != null
            ? ` (top strike ~${planeStrike.toFixed(0)}° / dip ~${planeDip?.toFixed(0)}°)`
            : ""}
          .
        </li>
        <li>
          <span className="text-foreground">Violet glow</span> = continuous stress-density field
          (toggle in legend if too strong/weak).
        </li>
        <li>
          <span className="text-foreground">Teal path</span>
          {migrationAz
            ? " = swarm centroid migration over the window."
            : " = migration (needs enough time bins)."}
        </li>
        <li>
          Map shows <strong>where</strong> stress concentrates; findings below show{" "}
          <strong>how ordered</strong> the swarm is — observational, not prediction.
        </li>
      </ul>
    </div>
  );
}
