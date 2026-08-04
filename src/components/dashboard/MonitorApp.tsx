import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Database,
  Layers,
  Map as MapIcon,
  RefreshCw,
  Satellite,
  Waves,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OsmEpicenterMap, type MapColorMode } from "@/components/map/OsmEpicenterMap";
import { DepthProfile } from "@/components/charts/DepthProfile";
import { TimelineCharts } from "@/components/charts/TimelineCharts";
import { SwarmPanel } from "@/components/swarm/SwarmPanel";
import { ObservationLinks } from "@/components/dashboard/ObservationLinks";
import { PulseStrip } from "@/components/dashboard/PulseStrip";
import { SchumannPanel } from "@/components/feeds/SchumannPanel";
import { GeonetVolcanoPanel } from "@/components/feeds/GeonetVolcanoPanel";
import { NotionFramework } from "@/components/feeds/NotionFramework";
import { PacificNodePanel } from "@/components/feeds/PacificNodePanel";
import { EpochLogPanel } from "@/components/feeds/EpochLogPanel";
import { LaicBrief } from "@/components/feeds/LaicBrief";
import { TsunamiPanel } from "@/components/feeds/TsunamiPanel";
import { VolcanoWatchPanel } from "@/components/feeds/VolcanoWatchPanel";
import { EventTable } from "@/components/dashboard/EventTable";
import { SesNetworkBar } from "@/components/dashboard/SesNetworkBar";
import { buildContinuumReport } from "@/lib/supt/continuum";
import { learnFromObservation } from "@/lib/supt/epochLog";
import { fetchSchumann } from "@/lib/supt/earthFeedsServer";
import { fetchSpaceWeather } from "@/lib/supt/kpServer";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import { SuptDetective } from "@/components/detective/SuptDetective";
import { StressMapPanel } from "@/components/detective/StressMapPanel";
import { getFocusNode } from "@/lib/seismic/focus-nodes";
import type { FocusNodeId, QuakeEvent, SwarmCluster } from "@/lib/seismic/types";
import { fetchCatalog, type CatalogPayload, type WindowKey } from "@/lib/seismic/server";
import { emptyCatalog, normalizeCatalog } from "@/lib/seismic/catalog";
import { getAuthority } from "@/lib/seismic/authority";
import {
  parseSesHandoff,
  syncBoardLocation,
} from "@/lib/seismic/ses-handoff";
import {
  documentTitleForNode,
  nodeMonitorSubtitle,
  nodeMonitorTitle,
} from "@/lib/seismic/branding";
import { classifySwarmIntensity } from "@/lib/seismic/intensity";
import {
  getQuietMode,
  setQuietMode,
  getQuietSource,
  getHeaderCollapsedPref,
  setHeaderCollapsedPref,
  type QuietSource,
} from "@/lib/ui/prefs";
import { mapFillHeightPx, preferCollapsedChrome } from "@/lib/ui/breakpoints";
import { useViewport } from "@/lib/ui/useViewport";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ShareMenu } from "@/components/ui/ShareMenu";
import { cn, formatDateTime, formatMag, formatRelativeTime, magValue } from "@/lib/utils";

type TabKey = "map" | "supt" | "depth" | "timeline" | "swarm" | "tsunami" | "catalog" | "feeds";

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "48h", label: "48h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "ytd", label: "YTD" },
];

const DEPTH_GATES: { km: number | null; label: string }[] = [
  { km: 70, label: "≤70 km" },
  { km: 40, label: "≤40 km" },
  { km: 20, label: "≤20 km" },
  { km: null, label: "All Z" },
];

const TABS: { key: TabKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "map", label: "Map", icon: MapIcon },
  { key: "supt", label: "SUPT", icon: Crosshair },
  { key: "depth", label: "Depth", icon: Layers },
  { key: "timeline", label: "Time", icon: Activity },
  { key: "swarm", label: "Swarms", icon: Waves },
  { key: "tsunami", label: "Tsunami", icon: AlertTriangle },
  { key: "feeds", label: "Feeds", icon: Satellite },
  { key: "catalog", label: "List", icon: Database },
];

type Props = {
  initial?: CatalogPayload | null;
};

export function MonitorApp({ initial }: Props) {
  const safeInitial = useMemo(
    () => normalizeCatalog(initial ?? emptyCatalog()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [data, setData] = useState<CatalogPayload>(safeInitial);
  const handoff = useMemo(() => parseSesHandoff(), []);
  const [fromSes, setFromSes] = useState(handoff.fromSes);
  const [nodeId, setNodeId] = useState<FocusNodeId>(() => {
    if (typeof window !== "undefined") {
      const n = (new URLSearchParams(window.location.search).get("node") || "").toLowerCase();
      if (n === "kamchatka" || n === "km" || n === "kuril" || n === "kurils" || n === "kvert")
        return "kamchatka";
      if (n === "japan" || n === "jp" || n === "jma" || n === "tokara" || n === "nansei" || n === "japan-arc")
        return "japan";
    }
    return handoff.focusFromQuery ?? safeInitial.nodeId ?? "japan";
  });
  const [windowKey, setWindowKey] = useState<WindowKey>(() => {
    if (typeof window !== "undefined") {
      const w = new URLSearchParams(window.location.search).get("window");
      if (w === "24h" || w === "48h" || w === "7d" || w === "30d" || w === "ytd") return w;
    }
    return safeInitial.window?.key ?? "7d";
  });
  const [minMag, setMinMag] = useState(0);
  const [maxDepthKm, setMaxDepthKm] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("map");
  const [colorMode, setColorMode] = useState<MapColorMode>("time");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastError, setLastError] = useState<string | null>(safeInitial.error ?? null);
  const [newSincePoll, setNewSincePoll] = useState(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [sw, setSw] = useState<SpaceWeatherSnapshot | null>(null);
  const [schumann, setSchumann] = useState<SchumannSnapshot | null>(null);
  const [quiet, setQuiet] = useState(() => getQuietMode());
  const [quietSource, setQuietSource] = useState<QuietSource>(() => getQuietSource());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const vp = useViewport();
  /** User override for header; null → responsive default */
  const [headerCollapsedUser, setHeaderCollapsedUser] = useState<boolean | null>(
    () => getHeaderCollapsedPref(),
  );
  const headerRef = useRef<HTMLElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [chromeH, setChromeH] = useState(96);
  const [tabsH, setTabsH] = useState(40);

  // Quiet + collapse prefs on mount
  useEffect(() => {
    setQuiet(getQuietMode());
    setQuietSource(getQuietSource());
    setHeaderCollapsedUser(getHeaderCollapsedPref());
  }, []);

  const node = useMemo(() => getFocusNode(nodeId), [nodeId]);
  const authority = useMemo(() => getAuthority(nodeId), [nodeId]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const result = await fetchCatalog({
          data: {
            nodeId,
            window: windowKey,
            minMagnitude: minMag > 0 ? minMag : undefined,
            maxDepthKm:
              nodeId === "japan"
                ? maxDepthKm == null
                  ? 0
                  : maxDepthKm
                : undefined,
            forceProvider:
              nodeId === "japan"
                ? "jma"
                : nodeId === "kamchatka"
                  ? "usgs"
                  : undefined,
          },
        });
        const normalized = normalizeCatalog(result);
        const ids = new Set((normalized.events ?? []).map((e) => e.id));
        if (prevIdsRef.current.size > 0) {
          let n = 0;
          for (const id of ids) if (!prevIdsRef.current.has(id)) n++;
          setNewSincePoll(n);
        }
        prevIdsRef.current = ids;
        setData(normalized);
        setLastError(normalized.error ?? null);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Catalog load failed");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [nodeId, windowKey, minMag, maxDepthKm],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep share URL + SES handoff params continuous with active node
  useEffect(() => {
    syncBoardLocation({ nodeId, windowKey, fromSes, replace: true });
  }, [nodeId, windowKey, fromSes]);

  // Browser tab title tracks active node monitor
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = documentTitleForNode(nodeId);
  }, [nodeId]);

  const selectNetworkNode = useCallback((id: FocusNodeId) => {
    setNodeId(id);
    // Arc / slab systems: default to all depths
    setMaxDepthKm(null);
    setSelectedId(null);
    setTab("map");
  }, [maxDepthKm]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void fetchSpaceWeather().then((s) => {
        if (!cancelled) setSw(s);
      });
      void fetchSchumann().then((s) => {
        if (!cancelled) setSchumann(s);
      });
    };
    tick();
    const id = window.setInterval(tick, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const events = Array.isArray(data?.events) ? data.events : [];
  const swarm = data?.swarm ?? emptyCatalog().swarm;
  const continuum = useMemo(
    () => buildContinuumReport(events, sw, Date.now(), schumann),
    [events, sw, schumann],
  );
  const intensity = useMemo(
    () => classifySwarmIntensity(swarm, events, nodeId),
    [nodeId, events, swarm],
  );

  useEffect(() => {
    if (!events.length && continuum.nEvents === 0) return;
    learnFromObservation({ nodeId, continuum, swarm, schumann });
  }, [nodeId, continuum, swarm, schumann, events.length]);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const largest = useMemo(
    () =>
      events.length
        ? events.reduce((a, b) =>
            magValue(a.magnitude, -99) >= magValue(b.magnitude, -99) ? a : b,
          )
        : null,
    [events],
  );

  const focusCluster = useCallback((cluster: SwarmCluster) => {
    if (cluster?.maxMagEvent?.id) setSelectedId(cluster.maxMagEvent.id);
    setTab("map");
  }, []);

  const onSelectEvent = useCallback((ev: QuakeEvent | null) => {
    setSelectedId(ev?.id ?? null);
  }, []);

  const toggleQuiet = () => {
    setQuiet((v) => {
      const next = !v;
      setQuietMode(next, "user");
      setQuietSource("user");
      return next;
    });
  };

  const filterActive =
    minMag > 0 || (nodeId === "japan" && maxDepthKm != null && maxDepthKm !== 8);

  // Collapsed header: user pref wins; else auto on map + (mobile | short)
  const headerCollapsed =
    headerCollapsedUser != null
      ? headerCollapsedUser
      : preferCollapsedChrome(vp, tab === "map" || tab === "supt");

  const toggleHeader = () => {
    const next = !headerCollapsed;
    setHeaderCollapsedUser(next);
    setHeaderCollapsedPref(next);
    if (next) setFiltersOpen(false);
  };

  // Measure sticky chrome (header only — tabs are in main, measured separately)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setChromeH(Math.ceil(el.getBoundingClientRect().height));
    });
    ro.observe(el);
    setChromeH(Math.ceil(el.getBoundingClientRect().height));
    return () => ro.disconnect();
  }, [headerCollapsed, filtersOpen, quiet]);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setTabsH(Math.ceil(el.getBoundingClientRect().height));
    });
    ro.observe(el);
    setTabsH(Math.ceil(el.getBoundingClientRect().height));
    return () => ro.disconnect();
  }, [tab]);

  // Map fill = visual viewport − header − tabs − main padding
  const mapHeightPx = mapFillHeightPx(
    vp,
    chromeH + tabsH,
    tab === "map" || tab === "supt" ? 16 : 0,
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header
        ref={headerRef}
        className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-2 py-1.5 sm:px-3">
          {/* Row 1: full product title · switcher (acronyms) · tools */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <Satellite className="size-3.5 shrink-0 text-accent" aria-hidden />
                <h1 className="min-w-0 text-[13px] font-semibold leading-snug tracking-tight sm:text-[15px]">
                  <span className="block truncate sm:inline">
                    {nodeMonitorTitle(nodeId)}
                  </span>
                </h1>
                {quiet && (
                  <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                    Quiet
                  </Badge>
                )}
              </div>
              {!headerCollapsed && (
                <p className="mt-0.5 truncate pl-5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                  {nodeMonitorSubtitle(
                    node.networkOrder,
                    authority.label.split("(")[0]?.trim() || authority.label,
                  )}
                </p>
              )}
              {headerCollapsed && (
                <p className="mt-0.5 truncate pl-5 text-[10px] leading-tight text-muted-foreground">
                  Sun-Earth-Sentinel · #{node.networkOrder}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
              <SesNetworkBar
                nodeId={nodeId}
                fromSes={fromSes}
                onSelectNode={selectNetworkNode}
                onDismissFromSes={() => setFromSes(false)}
              />
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant={headerCollapsed ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={toggleHeader}
                  title={headerCollapsed ? "Expand header" : "Collapse header — more map"}
                  aria-expanded={!headerCollapsed}
                  aria-label={headerCollapsed ? "Expand header" : "Collapse header"}
                >
                  {headerCollapsed ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronUp className="size-3.5" />
                  )}
                </Button>
                <ShareMenu
                  ctx={{
                    nodeId,
                    windowKey,
                    eii: continuum.eii,
                    rpam: continuum.rpam,
                    rate6h: swarm.rate6h,
                    eventCount: events.length,
                    largestMag: largest ? magValue(largest.magnitude) : null,
                  }}
                />
                {!headerCollapsed && <ThemeToggle />}
                <Button
                  variant={quiet ? "default" : "ghost"}
                  size="sm"
                  onClick={toggleQuiet}
                  className="h-8 w-8 px-0"
                  title={
                    quiet
                      ? "Quiet on — library links hidden (tap to expand)"
                      : "Quiet mode — hide secondary links"
                  }
                >
                  {quiet ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void load()}
                  disabled={loading}
                  className="h-8 w-8 px-0"
                  title="Refresh"
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                </Button>
                {!headerCollapsed && (
                  <Button
                    variant={autoRefresh ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoRefresh((v) => !v)}
                    className="h-8 min-w-9 px-1.5 font-mono text-[10px]"
                    title="Auto-refresh"
                  >
                    {autoRefresh ? "60s" : "Off"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: pulse alone — full width, no title collision */}
          <PulseStrip
            continuum={continuum}
            intensity={intensity}
            newSincePoll={newSincePoll}
            rate6h={swarm.rate6h}
            className="w-full min-w-0 border-0 bg-transparent px-0 py-0"
          />

          {/* Collapsible: time window · filters only (nodes live in switcher) */}
          {!headerCollapsed && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <div className="flex gap-0.5 overflow-x-auto">
                {WINDOWS.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setWindowKey(w.key)}
                    className={cn(
                      "min-h-7 min-w-8 rounded-md px-1.5 font-mono text-[11px] tabular-nums transition-colors",
                      windowKey === w.key
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                  filtersOpen || filterActive
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <SlidersHorizontal className="size-3" />
                <span className="hidden sm:inline">Filters</span>
                {filterActive && (
                  <span className="font-mono text-[10px]">
                    {minMag > 0 ? `M≥${minMag}` : ""}
                    {nodeId === "japan" && maxDepthKm != null && maxDepthKm !== 8
                      ? ` Z≤${maxDepthKm}`
                      : ""}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "size-3 opacity-70 transition-transform",
                    filtersOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
          )}

          {/* Collapsed: time windows only (app switch is in top rail) */}
          {headerCollapsed && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWindowKey(w.key)}
                  className={cn(
                    "min-h-6 shrink-0 rounded px-1.5 font-mono text-[10px] tabular-nums",
                    windowKey === w.key
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {!headerCollapsed && filtersOpen && (
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-secondary/25 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Min M
                </span>
                {[0, 1, 1.5, 2, 2.5, 3].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinMag(m)}
                    className={cn(
                      "min-h-7 min-w-8 rounded border px-1.5 font-mono text-[11px] tabular-nums",
                      minMag === m
                        ? "border-fg/30 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:bg-card",
                    )}
                  >
                    {m === 0 ? "All" : m.toFixed(1)}
                  </button>
                ))}
              </div>
              {nodeId === "japan" && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Depth
                  </span>
                  {DEPTH_GATES.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setMaxDepthKm(g.km)}
                      className={cn(
                        "min-h-7 rounded border px-1.5 font-mono text-[11px] tabular-nums",
                        maxDepthKm === g.km
                          ? "border-fg/30 bg-muted text-foreground"
                          : "border-border text-muted-foreground hover:bg-card",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] min-w-0 overflow-x-hidden px-2 py-1.5 sm:px-4 sm:py-2">
        {loading && events.length === 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
            <RefreshCw className="size-3.5 animate-spin" />
            Loading catalog…
          </div>
        )}

        {/* KPIs only off map — pulse strip covers EII/rate on map tab */}
        {tab !== "map" && tab !== "supt" && (
          <section className="mb-2 grid grid-cols-4 gap-1 sm:gap-1.5">
            <Kpi
              label="Events"
              value={String(data?.count ?? events.length)}
              sub={windowKey}
            />
            <Kpi
              label="Largest"
              value={largest ? `M${formatMag(largest.magnitude)}` : "—"}
              sub={largest ? formatRelativeTime(largest.time) : "—"}
              danger={!!largest && magValue(largest.magnitude) >= 4}
            />
            <Kpi
              label="1h / 6h"
              value={`${swarm.rate1h} / ${swarm.rate6h}`}
              sub={`${(swarm.shallowFraction * 100).toFixed(0)}% shallow`}
              warn={!!swarm.active}
            />
            <Kpi
              label="Mean Z"
              value={events.length ? `${swarm.meanDepthKm.toFixed(1)} km` : "—"}
              sub={swarm.active ? "swarm on" : `${swarm.clusters?.length ?? 0} clusters`}
              warn={!!swarm.active}
            />
          </section>
        )}

        {lastError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 text-xs">{lastError}</div>
          </div>
        )}

        {largest && magValue(largest.magnitude) >= 3.5 && tab !== "map" && tab !== "supt" && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="size-3.5 text-destructive" />
              <span className="font-medium">
                Peak M{formatMag(largest.magnitude)} · {formatRelativeTime(largest.time)} ·{" "}
                {largest.depthKm.toFixed(1)} km
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => {
                setSelectedId(largest.id);
                setTab("map");
              }}
            >
              Focus map
            </Button>
          </div>
        )}

        {/* Tabs — primary navigation */}
        <div
          ref={tabsRef}
          className="mb-2 flex gap-0.5 overflow-x-auto border-b border-border pb-0"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium transition-colors sm:px-3",
                  tab === t.key
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "map" && (
          <div className="map-shell @container/map flex flex-col gap-2">
            <Card className="overflow-hidden border-0 shadow-none sm:border sm:shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0 px-1 py-1 sm:px-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {events.length.toLocaleString()} · {windowKey}
                  </span>
                  {largest && magValue(largest.magnitude) >= 3.5 && (
                    <span className="truncate font-mono text-[10px] text-destructive">
                      Peak M{formatMag(largest.magnitude)} · {formatRelativeTime(largest.time)}
                    </span>
                  )}
                  <span className="map-shell-meta-extra hidden font-mono text-[10px] text-muted-foreground sm:inline">
                    {swarm.rate1h}/{swarm.rate6h}/6h · z̄ {events.length ? swarm.meanDepthKm.toFixed(1) : "—"} km
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {(["time", "depth", "mag"] as MapColorMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setColorMode(m)}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] uppercase",
                        colorMode === m
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-1 sm:pt-0">
                <div className="min-h-[280px] w-full"
                  style={{ height: mapHeightPx }}>
                  <OsmEpicenterMap
                    node={node}
                    events={events}
                    selectedId={selectedId}
                    onSelect={onSelectEvent}
                    colorMode={colorMode}
                  />
                </div>
              </CardContent>
            </Card>
            {!quiet && (
              <details className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                  Observation links
                </summary>
                <div className="border-t border-border p-2">
                  <ObservationLinks nodeId={nodeId} />
                </div>
              </details>
            )}
          </div>
        )}

        {tab === "supt" && (
          <div className="flex min-w-0 flex-col gap-3">
            <StressMapPanel
              events={events}
              node={node}
              swarm={swarm}
              height={mapHeightPx}
              spaceWeather={sw}
              schumannSnap={schumann}
            />
            <SuptDetective
              events={events}
              node={node}
              swarm={swarm}
              hideMap
              spaceWeather={sw}
              schumannSnap={schumann}
            />
          </div>
        )}

        {tab === "depth" && (
          <DepthProfile
            events={events}
            node={node}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        )}
        {tab === "timeline" && <TimelineCharts events={events} swarm={swarm} />}
        {tab === "swarm" && (
          <div
            className={cn(
              "grid gap-3",
              quiet && nodeId !== "kamchatka" ? "" : "lg:grid-cols-[1.25fr_1fr]",
            )}
          >
            <SwarmPanel
              swarm={swarm}
              events={events}
              nodeId={nodeId}
              onSelectCluster={focusCluster}
              onSelectEventId={setSelectedId}
              selectedEventId={selectedId}
              newCount={newSincePoll}
            />
            <div className="flex flex-col gap-3">
              {nodeId === "kamchatka" && <GeonetVolcanoPanel />}
              {!quiet && <ObservationLinks nodeId={nodeId} />}
            </div>
          </div>
        )}
        {tab === "tsunami" && (
        <div className="space-y-4">
          <TsunamiPanel events={events} />
          <VolcanoWatchPanel nodeId={nodeId} />
        </div>
      )}

      {tab === "feeds" && (

          <div className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Live signals
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                <SchumannPanel />
                <VolcanoWatchPanel nodeId={nodeId} />
              </div>
              {!quiet && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <TsunamiPanel events={events} />
                  <LaicBrief compact />
                </div>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Memory · export
              </h3>
              <EpochLogPanel
                nodeId={nodeId}
                continuum={continuum}
                swarm={swarm}
                schumann={schumann}
                density="full"
                enableLearn={false}
              />
            </section>
            {!quiet && (
              <details className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground">
                  Context library (Pacific · links · Notion)
                </summary>
                <div className="grid gap-3 border-t border-border p-3 lg:grid-cols-2">
                  <PacificNodePanel />
                  <ObservationLinks nodeId={nodeId} />
                  <div className="lg:col-span-2">
                    <NotionFramework />
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
        {tab === "catalog" && (
          <div className={cn("grid gap-3", quiet ? "" : "lg:grid-cols-[1.5fr_1fr]")}>
            <EventTable
              events={events}
              selectedId={selectedId}
              onSelect={(ev) => setSelectedId(ev.id)}
            />
            {!quiet && <ObservationLinks nodeId={nodeId} />}
          </div>
        )}

        {selected && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/20 bg-card px-3 py-2 text-xs">
            <div className="min-w-0">
              <span className="font-mono font-semibold">
                M{formatMag(selected.magnitude)} {selected.magType}
              </span>
              <span className="ml-2 text-muted-foreground">
                {formatDateTime(selected.time)} · {selected.depthKm.toFixed(1)} km ·{" "}
                {selected.place}
              </span>
            </div>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelectedId(null)}>
              Clear
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  danger,
  warn,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  warn?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border",
        compact ? "px-1.5 py-1 sm:px-2" : "px-2.5 py-1.5",
        danger && "border-destructive/40 bg-destructive/5",
        warn && !danger && "border-warn/35 bg-warn/5",
        !danger && !warn && "border-border bg-card",
      )}
    >
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono font-semibold tabular-nums leading-tight",
          compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
        )}
      >
        {value}
      </div>
      {sub && !compact && (
        <div className="truncate text-[10px] text-muted-foreground">{sub}</div>
      )}
      {sub && compact && (
        <div className="hidden truncate text-[9px] text-muted-foreground sm:block">{sub}</div>
      )}
    </div>
  );
}
