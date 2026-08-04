import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  Brain,
  Crosshair,
  GitBranch,
  ShieldAlert,
  Sun,
  Target,
  Waves,
  Orbit,
} from "lucide-react";
import type { FocusNode, QuakeEvent, SwarmAnalysis } from "@/lib/seismic/types";
import {
  runSwarmDetective,
  type SwarmDetectiveReport,
} from "@/lib/supt/detective";
import type { StressNode } from "@/lib/seismic/supt";
import {
  SUPT_ANCHORS,
  SUPT_COPYRIGHT,
  bandPlainLabel,
} from "@/lib/supt/probe";
import type { ContinuumReport } from "@/lib/supt/continuum";
import { fetchSpaceWeather } from "@/lib/supt/kpServer";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import { EpochLogPanel } from "@/components/feeds/EpochLogPanel";
import { LaicBrief } from "@/components/feeds/LaicBrief";
import { getSuptFocusMode, setSuptFocusMode } from "@/lib/ui/prefs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuptMap } from "@/components/detective/SuptMap";
import { formatDateTime, formatMag, cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type Props = {
  events: QuakeEvent[];
  node: FocusNode;
  swarm: SwarmAnalysis;
  /** When true, skip embedded map (SUPT tab already shows StressMapPanel). */
  hideMap?: boolean;
  /** Shared parent feeds — skips local poll when provided */
  spaceWeather?: SpaceWeatherSnapshot | null;
  schumannSnap?: SchumannSnapshot | null;
};

const TONE: Record<string, string> = {
  none: "border-border bg-card",
  chance: "border-accent/30 bg-accent/5",
  ordered: "border-warn/40 bg-warn/10",
  mixed: "border-warn/30 bg-warn/5",
  sparse: "border-border bg-secondary/40",
  null: "border-border bg-card",
};

export function SuptDetective({
  events,
  node,
  swarm,
  hideMap = false,
  spaceWeather,
  schumannSnap,
}: Props) {
  const [localSw, setLocalSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [localSch, setLocalSch] = useState<SchumannSnapshot | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [focusMode, setFocusMode] = useState(() => getSuptFocusMode());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const useParentFeeds = spaceWeather !== undefined || schumannSnap !== undefined;
  const sw = spaceWeather !== undefined ? spaceWeather : localSw;
  const schumann = schumannSnap !== undefined ? schumannSnap : localSch;

  useEffect(() => {
    if (useParentFeeds) return;
    let cancelled = false;
    const load = () => {
      void fetchSpaceWeather().then((snap) => {
        if (!cancelled) setLocalSw(snap);
      });
      void fetchSchumann().then((snap) => {
        if (!cancelled) setLocalSch(snap);
      });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [useParentFeeds]);

  const report: SwarmDetectiveReport = useMemo(
    () => runSwarmDetective(events, node, swarm, Date.now(), sw, schumann),
    [events, node, swarm, sw, schumann],
  );

  const selected: StressNode | null =
    report.fabric.stressNodes.find((n) => n.id === selectedNodeId) ??
    report.fabric.stressNodes[0] ??
    null;

  const scoreData = report.fabric.stressNodes.map((n) => ({
    name: `#${n.rank}`,
    score: n.score,
    id: n.id,
  }));

  const localForSelected = report.localProbes.find((p) => p.nodeId === selected?.id);
  const C = report.continuum;
  const H = report.harmonic;

  const bandChart = [
    { name: "Tremor", value: H.fingerprint.tremor, fill: "var(--color-accent)" },
    { name: "Mixed", value: H.fingerprint.mixed, fill: "var(--color-warn)" },
    { name: "Fracture", value: H.fingerprint.fracture, fill: "var(--color-destructive)" },
  ];

  const toggleFocus = () => {
    setFocusMode((v) => {
      const next = !v;
      setSuptFocusMode(next);
      return next;
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden">
      {/* Map only when standalone; SUPT tab supplies StressMapPanel above */}
      {!hideMap && (
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Stress & fracture map</CardTitle>
              <CardDescription className="text-[11px]">
                Fullscreen · Home resets caldera · layer toggles on map
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-1 pt-0 sm:p-2 sm:pt-0">
            <div className="h-[min(62vh,560px)] min-h-[320px]">
              <SuptMap
                node={node}
                events={events}
                planes={report.fabric.planes}
                stressNodes={report.fabric.stressNodes}
                lineaments={report.fabric.lineaments}
                migration={report.fabric.migration}
                stressField={report.fabric.stressField}
                selectedNodeId={selected?.id}
                onSelectNode={setSelectedNodeId}
                height={560}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-warn" />
                <CardTitle>Detective findings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
              {report.findings.map((f) => (
                <div
                  key={f.id}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    f.severity === "alert" && "border-destructive/35 bg-destructive/5",
                    f.severity === "watch" && "border-warn/35 bg-warn/5",
                    f.severity === "info" && "border-border bg-secondary/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        f.severity === "alert"
                          ? "critical"
                          : f.severity === "watch"
                            ? "warn"
                            : "outline"
                      }
                    >
                      {f.severity}
                    </Badge>
                    <span className="text-sm font-medium">{f.title}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {f.detail}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Crosshair className="size-4 text-accent" />
                  <CardTitle className="text-sm">
                    Stress node #{selected.rank}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <Row k="Score" v={String(selected.score)} />
                <Row
                  k="Location"
                  v={`${selected.location.lat.toFixed(3)}°, ${selected.location.lon.toFixed(3)}°`}
                />
                <Row k="Depth" v={`${selected.depthKm.toFixed(1)} km`} />
                <Row k="Events in cell" v={String(selected.eventCount)} />
                {localForSelected && (
                  <Row
                    k="Local SUPT"
                    v={
                      localForSelected.resonance.d_ij != null
                        ? `${localForSelected.resonance.band} d=${localForSelected.resonance.d_ij.toFixed(3)}`
                        : "—"
                    }
                  />
                )}
                <p className="pt-1 text-[11px] text-muted-foreground">{selected.interpretation}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      )}

      {hideMap && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-warn" />
              <CardTitle>Detective findings</CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                map + window
              </Badge>
            </div>
            <CardDescription className="text-[11px]">
              Map above · findings from the same window · not a forecast
            </CardDescription>
          </CardHeader>
          <CardContent className="flex max-h-[min(40vh,360px)] flex-col gap-2 overflow-y-auto">
            {report.findings.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  f.severity === "alert" && "border-destructive/35 bg-destructive/5",
                  f.severity === "watch" && "border-warn/35 bg-warn/5",
                  f.severity === "info" && "border-border bg-secondary/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      f.severity === "alert"
                        ? "critical"
                        : f.severity === "watch"
                          ? "warn"
                          : "outline"
                    }
                  >
                    {f.severity}
                  </Badge>
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {f.detail}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Epoch log lives on Feeds when hideMap — avoid double panel on SUPT tab */}
      {!hideMap && (
        <EpochLogPanel
          nodeId={node.id}
          continuum={C}
          swarm={swarm}
          schumann={schumann}
          density="compact"
          enableLearn={false}
        />
      )}

      {/* Hero — plain language by default; Technical reveals operator codes */}
      <Card className={cn("border-accent/25", TONE[report.verdict.tone] ?? TONE.none)}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Brain className="size-4 text-accent" />
            <CardTitle>Swarm detective</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              observational
            </Badge>
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!focusMode) toggleFocus();
                }}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                  focusMode
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => {
                  if (focusMode) toggleFocus();
                }}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                  !focusMode
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Technical
              </button>
            </div>
          </div>
          <CardDescription>
            {focusMode
              ? "Plain reading of this window’s timing and energy. Not a forecast."
              : "Operator view — SUPT codes, ETAS, harmonic, tables. Not a forecast."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center sm:text-left">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              This window · {report.sampleSize} events
            </div>
            <p className="mt-1 text-lg font-semibold leading-snug sm:text-xl">
              {report.verdict.title}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/90">
              {report.reading}
            </p>
            {focusMode ? (
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                {plainDetectiveBlurb(report)}
              </p>
            ) : (
              <>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  {report.detectiveSummary}
                </p>
                <button
                  type="button"
                  onClick={() => setShowTech((v) => !v)}
                  className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {showTech ? "Hide" : "Show"} SUPT operator detail
                </button>
                {showTech && (
                  <p className="mt-1 rounded-md border border-border bg-card/80 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {report.readingTech}
                  </p>
                )}
              </>
            )}
          </div>

          {focusMode ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <PlainStat
                label="Timing"
                value={
                  report.resonance.d_ij == null
                    ? "Need more events"
                    : report.resonance.separated
                      ? bandPlainLabel(report.resonance.band)
                      : "Looks ordinary"
                }
                hint="How quakes space in time"
                warn={report.resonance.separated}
              />
              <PlainStat
                label="Aftershock check"
                value={plainEtas(report.etas.verdict)}
                hint="Is order just clustering?"
                warn={report.etas.verdict === "survives"}
              />
              <PlainStat
                label="Energy load"
                value={plainEnergy(C.eii, C.rpam)}
                hint={`${Math.round(C.shallowRatio * 100)}% shallow · max M${formatMag(C.mdMax)}`}
                warn={C.eii >= 0.6}
              />
              <PlainStat
                label="Stress zones"
                value={`${report.fabric.stressNodes.length} ranked`}
                hint={
                  selected
                    ? `#1 score ${report.fabric.stressNodes[0]?.score ?? "—"} on map`
                    : "Amber discs on map"
                }
              />
              <PlainStat
                label="Fracture lines"
                value={
                  report.fabric.planes.length
                    ? `${report.fabric.planes.length} fitted`
                    : "None strong"
                }
                hint="Magenta traces on map"
              />
              <PlainStat
                label="Space weather"
                value={plainSpaceWeather(C.kp, C.schumannIndex)}
                hint={`Kp ${C.kp.toFixed(1)} · Schumann ${C.schumannIndex || "—"}`}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <Mini
                label="d_ij"
                value={report.resonance.d_ij != null ? report.resonance.d_ij.toFixed(3) : "—"}
                hint={report.resonance.band}
              />
              <Mini
                label="vs shuffle"
                value={
                  report.resonance.d_ij == null
                    ? "—"
                    : report.resonance.separated
                      ? "Unusual"
                      : "Typical"
                }
                hint={
                  report.resonance.z != null
                    ? `z=${report.resonance.z.toFixed(2)}`
                    : "null baseline"
                }
                warn={report.resonance.separated}
              />
              <Mini label="ETAS" value={report.etas.verdict} hint={`n=${report.etas.nEvents}`} />
              <Mini label="EII" value={C.eii.toFixed(3)} hint={C.rpam} warn={C.eii >= 0.6} />
              <Mini label="CCI" value={C.cci.toFixed(3)} hint={C.cciLabel} />
              <Mini
                label="SR"
                value={String(C.schumannIndex || "—")}
                hint={`×${C.schumannFactor.toFixed(2)}`}
              />
              <Mini
                label="Stress"
                value={String(report.fabric.stressNodes.length)}
                hint="nodes"
              />
              <Mini
                label="Planes"
                value={String(report.fabric.planes.length)}
                hint="fracture"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Continuum — plain vs technical */}
      <Card className="border-warn/20">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sun className="size-4 text-warn" />
            <CardTitle className="text-sm">
              {focusMode ? "Energy & space weather" : "ReSunance Continuum — EII / RPAM / CCI"}
            </CardTitle>
            {!focusMode && (
              <Badge variant="outline" className="text-[10px]">
                v6.5 + Schumann
              </Badge>
            )}
          </div>
          {focusMode && (
            <CardDescription className="text-[11px]">
              How “loaded” this window looks from quakes + live space feeds — still not a forecast.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {focusMode ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PlainStat
                  label="Energy load"
                  value={plainEnergy(C.eii, C.rpam)}
                  hint={`index ${C.eii.toFixed(2)}`}
                  warn={C.eii >= 0.6}
                />
                <PlainStat
                  label="Quake contribution"
                  value={C.eiiBase >= 0.6 ? "Strong" : C.eiiBase >= 0.35 ? "Moderate" : "Light"}
                  hint={`max M${formatMag(C.mdMax)} · mean M${formatMag(C.mdMean)}`}
                />
                <PlainStat
                  label="Geomagnetic"
                  value={geomagPlain(C.kp)}
                  hint={`Kp ${C.kp.toFixed(1)}`}
                />
                <PlainStat
                  label="Schumann"
                  value={
                    C.schumannIndex >= 70
                      ? "Elevated"
                      : C.schumannIndex >= 40
                        ? "Active"
                        : C.schumannIndex > 0
                          ? "Quiet"
                          : "No data"
                  }
                  hint={C.schumannIndex ? `SR ${C.schumannIndex}` : "feed"}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FeedPill label="Kp" status={C.feeds.kp} />
                <FeedPill label="Solar wind" status={C.feeds.plasma} />
                <FeedPill label="Seismic" status={C.feeds.seismic} />
                <FeedPill label="Schumann" status={C.feeds.schumann} />
              </div>
              <p className="rounded-md border border-border bg-secondary/40 p-2.5 leading-relaxed text-muted-foreground">
                {plainContinuumNote(C)}
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <FeedPill label="NOAA Kp" status={C.feeds.kp} />
                <FeedPill label="Solar wind" status={C.feeds.plasma} />
                <FeedPill label="Seismic" status={C.feeds.seismic} />
                <FeedPill label="Schumann" status={C.feeds.schumann} />
                <Badge variant="outline" className="font-mono text-[10px]">
                  ψₛ={C.psiS.toFixed(2)} · {C.psiSource}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini label="EII" value={C.eii.toFixed(3)} hint="with Schumann" warn={C.eii >= 0.6} />
                <Mini label="EII base" value={C.eiiBase.toFixed(3)} hint="pre-ELF" />
                <Mini label="RPAM" value={C.rpam} hint="phase" warn={C.rpam !== "MONITORING"} />
                <Mini label="CCI" value={C.cci.toFixed(3)} hint={C.cciLabel} />
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                <Row k="Md max / mean" v={`${formatMag(C.mdMax)} / ${formatMag(C.mdMean)}`} />
                <Row
                  k="Shallow under 2.5 km"
                  v={`${(C.shallowRatio * 100).toFixed(0)}% · n=${C.nEvents}`}
                />
                <Row
                  k="Schumann SR / factor"
                  v={`${C.schumannIndex} / ${C.schumannFactor.toFixed(2)}`}
                />
                <Row k="ELF term" v={C.terms.schumannTerm.toFixed(3)} />
                <Row
                  k="Solar wind speed"
                  v={C.solarSpeed > 0 ? `${C.solarSpeed.toFixed(0)} km/s` : "—"}
                />
                <Row k="Kp index" v={C.kp.toFixed(1)} />
              </div>
              <p className="rounded-md border border-border bg-secondary/40 p-2.5 leading-relaxed text-muted-foreground">
                {C.diagnostic}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Technical-only stack */}
      {!focusMode && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <Stage
              icon={Activity}
              code="1"
              title="SUPT raw"
              body={
                report.resonance.d_ij != null
                  ? `${report.resonance.band} · d=${report.resonance.d_ij.toFixed(3)}`
                  : "Need ≥4 gaps"
              }
            />
            <Stage icon={Waves} code="2" title="ETAS residual" body={`${report.etas.verdict}`} />
            <Stage
              icon={Sun}
              code="3"
              title="Continuum"
              body={`EII ${C.eii.toFixed(2)} · ${C.rpam} · Kp ${C.kp.toFixed(1)}`}
            />
            <Stage
              icon={Orbit}
              code="4"
              title="Harmonic"
              body={
                H.comparisons[0]?.r != null
                  ? `Kam r=${H.comparisons[0].r.toFixed(2)} · ψ ${H.strongAspectCount} tags`
                  : "Fingerprint only"
              }
            />
            <Stage
              icon={Target}
              code="5"
              title="Fabric + local"
              body={
                selected
                  ? `Node #${selected.rank} score ${selected.score}`
                  : `${report.fabric.stressNodes.length} nodes`
              }
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Orbit className="size-4 text-accent" />
                <CardTitle>Comparative harmonic fingerprint</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  Harmonic System
                </Badge>
              </div>
              <CardDescription>
                Band weights (tremor / mixed / fracture proxies) + template correlation + ψ-fold
                aspects.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid
                      stroke="var(--color-chart-grid)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {bandChart.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2">
                {H.comparisons.map((c) => (
                  <span
                    key={c.name}
                    className="rounded-md border border-border px-2 py-1 font-mono text-[10px]"
                  >
                    {c.name} r={c.r != null ? c.r.toFixed(3) : "—"}
                  </span>
                ))}
                <span className="rounded-md border border-border px-2 py-1 font-mono text-[10px]">
                  self r=
                  {H.selfCorrelation != null ? H.selfCorrelation.toFixed(3) : "—"}
                </span>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  ψ-fold aspects (Moon–body)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {H.aspects.map((a) => (
                    <span
                      key={a.body}
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                        a.tag === "Strong" && "border-warn/40 bg-warn/10 text-warn",
                        a.tag === "Quadrature" && "border-destructive/30 bg-destructive/5",
                        a.tag === "Trine" && "border-accent/30 bg-accent/10",
                        a.tag === "Weak" && "border-border text-muted-foreground",
                      )}
                      title={`ψ=${a.psi}`}
                    >
                      {a.body} {a.deg.toFixed(0)}° · {a.tag}
                    </span>
                  ))}
                </div>
              </div>
              <p className="leading-relaxed text-muted-foreground">{H.cascadeHint}</p>
              <p className="text-[10px] text-muted-foreground">{H.note}</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>ETAS residual control</CardTitle>
                <CardDescription>
                  Does ordered timing survive Omori-style aftershock whitening?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      report.etas.verdict === "survives"
                        ? "critical"
                        : report.etas.verdict === "vanishes"
                          ? "warn"
                          : "outline"
                    }
                  >
                    {report.etas.verdict}
                  </Badge>
                  <span className="text-muted-foreground">
                    n={report.etas.nEvents} events w/ mag
                  </span>
                </div>
                <p className="leading-relaxed text-muted-foreground">{report.etas.plain}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Row
                    k="Raw d_ij"
                    v={report.etas.rawD != null ? report.etas.rawD.toFixed(3) : "—"}
                  />
                  <Row
                    k="Whitened d_ij"
                    v={report.etas.whiteD != null ? report.etas.whiteD.toFixed(3) : "—"}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Active swarm pulse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {!report.swarmResonance ? (
                  <p className="text-muted-foreground">
                    No active swarm dense enough for a pulse probe (need ≥5 events).
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={report.swarmResonance.separated ? "warn" : "outline"}>
                        {report.swarmResonance.band}
                      </Badge>
                      <span className="font-mono tabular-nums">
                        d={report.swarmResonance.d_ij?.toFixed(3) ?? "—"} · n=
                        {report.swarmResonance.n}
                      </span>
                    </div>
                    <p className="leading-relaxed text-muted-foreground">{report.swarmReading}</p>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
                  <Row k="6 h rate" v={`${report.fabric.unfold.rate6h} events`} />
                  <Row k="Mean depth" v={`${report.fabric.unfold.meanDepthKm.toFixed(1)} km`} />
                  <Row
                    k="b-value"
                    v={
                      report.fabric.unfold.globalBValue != null
                        ? report.fabric.unfold.globalBValue.toFixed(2)
                        : "—"
                    }
                  />
                  <Row
                    k="Shallow under 3 km"
                    v={`${(report.fabric.unfold.shallowFraction * 100).toFixed(0)}%`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {scoreData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Stress node ranking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid
                        stroke="var(--color-chart-grid)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                      />
                      <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                        {scoreData.map((d) => (
                          <Cell
                            key={d.id}
                            fill={
                              d.id === selected?.id
                                ? "var(--color-destructive)"
                                : "var(--color-warn)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4" />
                  <CardTitle>Candidate fracture planes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="min-w-0 overflow-x-auto">
                {report.fabric.planes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No planar structure meets confidence gates in this sample.
                  </p>
                ) : (
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-1.5 pr-2 font-medium">Label</th>
                        <th className="py-1.5 pr-2 font-medium">Strike</th>
                        <th className="py-1.5 pr-2 font-medium">Dip</th>
                        <th className="py-1.5 pr-2 font-medium">Conf</th>
                        <th className="py-1.5 font-medium">n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.fabric.planes.slice(0, 8).map((p) => (
                        <tr key={p.id} className="border-b border-border/60">
                          <td className="py-1.5 pr-2 font-medium">{p.label}</td>
                          <td className="py-1.5 pr-2 font-mono tabular-nums">
                            {p.strikeDeg.toFixed(0)}°
                          </td>
                          <td className="py-1.5 pr-2 font-mono tabular-nums">
                            {p.dipDeg.toFixed(0)}°
                          </td>
                          <td className="py-1.5 pr-2 font-mono tabular-nums">
                            {(p.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="py-1.5 font-mono tabular-nums">{p.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Local SUPT probes</CardTitle>
                <CardDescription>Resonance at top stress cells</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {report.localProbes.length === 0 ? (
                  <p className="text-muted-foreground">No local probes.</p>
                ) : (
                  report.localProbes.map((p) => (
                    <div
                      key={p.nodeId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                    >
                      <span className="font-medium">#{p.rank}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        score {p.score} · n={p.eventCount}
                      </span>
                      <Badge variant={p.resonance.separated ? "warn" : "outline"}>
                        {p.resonance.band}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <LaicBrief compact />

          <p className="text-[10px] text-muted-foreground">
            {SUPT_COPYRIGHT.notice} · anchors ζ={SUPT_ANCHORS.zetaFloor} · ribosome=
            {SUPT_ANCHORS.ribosome} · tokamak={SUPT_ANCHORS.tokamak}
          </p>
        </>
      )}

      {focusMode && (
        <p className="text-center text-[11px] text-muted-foreground">
          Simple view —{" "}
          <button type="button" className="text-accent hover:underline" onClick={toggleFocus}>
            open Technical
          </button>{" "}
          for SUPT codes, ETAS, harmonic tables, LAIC.
        </p>
      )}
    </div>
  );
}

function plainEtas(v: string): string {
  if (v === "survives") return "Still unusual";
  if (v === "vanishes") return "Mostly clustering";
  if (v === "both-null") return "No strong order";
  if (v === "insufficient") return "Too few events";
  return v;
}

function plainEnergy(eii: number, rpam: string): string {
  if (rpam === "ACTIVE" || eii >= 0.85) return "High";
  if (rpam === "ELEVATED" || eii >= 0.6) return "Elevated";
  if (eii >= 0.35) return "Moderate";
  return "Baseline";
}

function plainSpaceWeather(kp: number, sr: number): string {
  const geo = kp >= 5 ? "Stormy" : kp >= 4 ? "Unsettled" : kp >= 3 ? "Active" : "Quiet";
  if (sr >= 70) return `${geo} · SR high`;
  if (sr >= 40) return `${geo} · SR active`;
  return geo;
}

function geomagPlain(kp: number): string {
  if (kp >= 5) return "Storm level";
  if (kp >= 4) return "Unsettled";
  if (kp >= 3) return "Active";
  return "Quiet";
}

function plainDetectiveBlurb(report: SwarmDetectiveReport): string {
  const top = report.fabric.stressNodes[0];
  const planes = report.fabric.planes.length;
  const bits: string[] = [];
  if (top) {
    bits.push(
      `Map ranks stress zone #1 at about ${top.depthKm.toFixed(1)} km (score ${top.score}/100).`,
    );
  }
  if (planes > 0) {
    bits.push(`${planes} candidate fracture line${planes === 1 ? "" : "s"} fitted from hypocentres.`);
  } else {
    bits.push("No strong fracture plane in this sample.");
  }
  bits.push("Scroll the map for nodes · findings card lists what the detective flags.");
  return bits.join(" ");
}

function plainContinuumNote(C: ContinuumReport): string {
  const load = plainEnergy(C.eii, C.rpam);
  const shallow = Math.round(C.shallowRatio * 100);
  return (
    `Energy load is ${load.toLowerCase()} for this window` +
    ` (${shallow}% of events under 2.5 km` +
    (C.mdMax > 0 ? `, largest M${formatMag(C.mdMax)}` : "") +
    `). Geomagnetic Kp ${C.kp.toFixed(1)} · Schumann ${C.schumannIndex || "n/a"}. ` +
    `These are co-registered observations — not a prediction of the next quake.`
  );
}

function PlainStat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        warn ? "border-warn/40 bg-warn/5" : "border-border bg-card",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Mini({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        warn ? "border-warn/40 bg-warn/5" : "border-border bg-card",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
      {hint && <div className="truncate text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-mono tabular-nums text-foreground">{v}</span>
    </div>
  );
}

function FeedPill({
  label,
  status,
}: {
  label: string;
  status: "ok" | "degraded" | "down";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
        status === "ok" && "border-accent/30 bg-accent/10 text-accent",
        status === "degraded" && "border-warn/30 bg-warn/10 text-warn",
        status === "down" && "border-border text-muted-foreground",
      )}
    >
      {label}: {status}
    </span>
  );
}

function Stage({
  icon: Icon,
  code,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  code: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        <span className="font-mono">{code}</span>
        <span className="font-medium text-foreground">{title}</span>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{body}</p>
    </div>
  );
}
