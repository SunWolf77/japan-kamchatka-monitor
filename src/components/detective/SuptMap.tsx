import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Expand, HelpCircle, Home, Layers, X } from "lucide-react";
import type { FocusNode, QuakeEvent } from "@/lib/seismic/types";
import type { FracturePlane, StressNode, Lineament, MigrationStep } from "@/lib/seismic/supt";
import { leafletMagRadius, timeAgeColor, eventAge01 } from "@/lib/seismic/colors";
import { magValue, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { basemapTileOptions, basemapTileUrl } from "@/lib/map/tiles";

/** Distinct SUPT layer palette — nodes ≠ fractures */
export const SUPT_LAYER_COLORS = {
  /** Stress nodes — amber core, dark ring */
  nodeFill: "#ffb300",
  nodeStroke: "#1a1200",
  nodeSel: "#ff6f00",
  /** Fracture traces — magenta (not orange) */
  fracture: "#c2185b",
  fractureTick: "#880e4f",
  /** Lineaments — indigo dashed */
  lineament: "#3949ab",
  /** Migration — teal */
  migration: "#00838f",
  migrationEnd: "#26c6da",
  /** Stress density field — strong violet haze (readable on OSM) */
  fieldHot: "#5e35b1",
  fieldMid: "#7e57c2",
  fieldCool: "#9575cd",
  /** Principal axes */
  sigmaParallel: "#212121",
  sigmaNormal: "#1565c0",
} as const;

type Props = {
  node: FocusNode;
  events: QuakeEvent[];
  planes: FracturePlane[];
  stressNodes: StressNode[];
  lineaments: Lineament[];
  migration: MigrationStep[];
  stressField: { lat: number; lon: number; intensity: number }[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  className?: string;
  height?: number | string;
  showControls?: boolean;
  defaultFullscreen?: boolean;
  onFullscreenChange?: (fs: boolean) => void;
};

/**
 * Leaflet map with SUPT overlays.
 * Colors: amber nodes · magenta fractures · indigo lineaments · teal migration.
 */
export function SuptMap({
  node,
  events,
  planes,
  stressNodes,
  lineaments,
  migration,
  stressField,
  selectedNodeId,
  onSelectNode,
  className,
  height = 420,
  showControls = true,
  defaultFullscreen = false,
  onFullscreenChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const drawRef = useRef<() => Promise<void>>(async () => {});
  const [fullscreen, setFullscreen] = useState(defaultFullscreen);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Layers panel collapsed by default — critical on mobile so map stays clear */
  const [layersOpen, setLayersOpen] = useState(false);
  /** Toggle layers — shape + colour in legend for clarity */
  const [layers, setLayers] = useState({
    field: true,
    events: true,
    lineaments: true,
    fractures: true,
    axes: true,
    migration: true,
    nodes: true,
  });
  const layersRefState = useRef(layers);
  layersRefState.current = layers;
  const toggleLayer = (k: keyof typeof layers) =>
    setLayers((prev) => ({ ...prev, [k]: !prev[k] }));

  // Entering fullscreen → collapse layers so map is unobstructed on phones
  useEffect(() => {
    if (fullscreen) setLayersOpen(false);
  }, [fullscreen]);

  const tRange = useMemo(() => {
    if (!events.length) {
      const n = Date.now();
      return { tMin: n - 864e5, tMax: n };
    }
    const ts = events.map((e) => e.time);
    return { tMin: Math.min(...ts), tMax: Math.max(...ts) };
  }, [events]);

  const goHome = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = await import("leaflet");
    const view = node.mapView ?? node.bbox;
    const pad = node.mapPad ?? 0.015;
    const bounds = L.latLngBounds(
      [view.minLat - pad, view.minLon - pad],
      [view.maxLat + pad, view.maxLon + pad],
    );
    const maxZoom = node.id === "japan" ? 13 : 8;
    map.fitBounds(bounds, { padding: [16, 16], maxZoom, animate: true });
  }, [node]);

  const fitToFabric = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = await import("leaflet");
    const pts: [number, number][] = [];
    stressNodes.forEach((s) => pts.push([s.location.lat, s.location.lon]));
    planes.forEach((p) => {
      pts.push([p.trace[0].lat, p.trace[0].lon]);
      pts.push([p.trace[1].lat, p.trace[1].lon]);
    });
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
      });
    } else {
      await goHome();
    }
  }, [stressNodes, planes, goHome]);

  const setFs = useCallback(
    (fs: boolean) => {
      setFullscreen(fs);
      onFullscreenChange?.(fs);
      if (typeof document !== "undefined") {
        document.body.style.overflow = fs ? "hidden" : "";
      }
      window.setTimeout(() => {
        mapRef.current?.invalidateSize({ animate: false });
      }, 80);
    },
    [onFullscreenChange],
  );

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (layersOpen) setLayersOpen(false);
        else if (fullscreen) setFs(false);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "l" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setLayersOpen((v) => !v);
      } else if (k === "h" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void goHome();
      } else if (k === "g" && !e.metaKey && !e.ctrlKey) {
        // g = fabric / geometry frame (F is often find)
        e.preventDefault();
        void fitToFabric();
      } else if (k === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFs(!fullscreen);
      } else if ((k === "+" || k === "=") && mapRef.current) {
        e.preventDefault();
        mapRef.current.zoomIn();
      } else if ((k === "-" || k === "_") && mapRef.current) {
        e.preventDefault();
        mapRef.current.zoomOut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, helpOpen, layersOpen, setFs, goHome, fitToFabric]);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      const L = await import("leaflet");
      const map = mapRef.current;
      const group = layersRef.current;
      if (!map || !group) return;
      group.clearLayers();
      const C = SUPT_LAYER_COLORS;

      const vis = layersRefState.current;

      // Stress density field (soft purple haze — not amber, not magenta)
      if (vis.field) {
        // Two-pass haze: wide soft underlay + tighter core (readable on OSM)
        for (const cell of stressField) {
          if (cell.intensity < 0.08) continue;
          L.circleMarker([cell.lat, cell.lon], {
            radius: 14 + cell.intensity * 28,
            stroke: false,
            fillColor: fieldColor(cell.intensity),
            fillOpacity: 0.14 + cell.intensity * 0.28,
          }).addTo(group);
        }
        for (const cell of stressField) {
          if (cell.intensity < 0.25) continue;
          L.circleMarker([cell.lat, cell.lon], {
            radius: 5 + cell.intensity * 12,
            stroke: false,
            fillColor: fieldColor(cell.intensity),
            fillOpacity: 0.22 + cell.intensity * 0.35,
          }).addTo(group);
        }
      }

      // Lineaments — indigo dashed (fabric grain)
      if (vis.lineaments) for (const lin of lineaments) {
        L.polyline(
          [
            [lin.endpoints[0].lat, lin.endpoints[0].lon],
            [lin.endpoints[1].lat, lin.endpoints[1].lon],
          ],
          {
            color: C.lineament,
            weight: 1.5 + lin.weight * 2,
            dashArray: "7 5",
            opacity: 0.55 + lin.weight * 0.35,
          },
        )
          .bindTooltip(`Lineament ~${lin.strikeDeg.toFixed(0)}° (pairwise fabric)`, {
            sticky: true,
          })
          .addTo(group);
      }

      // Fracture traces — MAGENTA solid + white halo (line ≠ circle)
      if (vis.fractures) for (const pl of planes) {
        // white underlay for contrast on basemap
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: "#ffffff",
            weight: 6 + pl.confidence * 2.5,
            opacity: 0.85,
            lineCap: "round",
          },
        ).addTo(group);
        L.polyline(
          [
            [pl.trace[0].lat, pl.trace[0].lon],
            [pl.trace[1].lat, pl.trace[1].lon],
          ],
          {
            color: C.fracture,
            weight: 3 + pl.confidence * 2.5,
            opacity: 0.95,
            lineCap: "round",
          },
        )
          .bindTooltip(
            `<strong style="color:${C.fracture}">Fracture · ${pl.label}</strong><br/>` +
              `strike ${pl.strikeDeg.toFixed(0)}° · dip ${pl.dipDeg.toFixed(0)}°<br/>` +
              `conf ${(pl.confidence * 100).toFixed(0)}% · n=${pl.support} · RMS ${pl.rmsKm.toFixed(2)} km`,
            { sticky: true },
          )
          .addTo(group);

        // Strike tick at centroid (small magenta diamond)
        L.circleMarker([pl.centroid.lat, pl.centroid.lon], {
          radius: 5,
          color: C.fractureTick,
          fillColor: C.fracture,
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(`Plane centroid · strike ${pl.strikeDeg.toFixed(0)}°`)
          .addTo(group);

        // Principal-axis proxy (optional)
        if (vis.axes) drawStressAxes(L, group, pl, C);
      }

      // Migration — teal arrows-ish path
      if (vis.migration && migration.length >= 2) {
        const latlngs = migration.map(
          (m) => [m.centroid.lat, m.centroid.lon] as [number, number],
        );
        L.polyline(latlngs, {
          color: C.migration,
          weight: 2.5,
          opacity: 0.9,
        }).addTo(group);
        migration.forEach((m, i) => {
          L.circleMarker([m.centroid.lat, m.centroid.lon], {
            radius: i === migration.length - 1 ? 7 : 3.5,
            color: "#004d40",
            fillColor: i === migration.length - 1 ? C.migrationEnd : C.migration,
            fillOpacity: 0.95,
            weight: 1.5,
          })
            .bindTooltip(`Migration step ${i + 1} · n=${m.count}`, { direction: "top" })
            .addTo(group);
        });
      }

      // Events (subtle grey-blue dots — not SUPT targets)
      if (vis.events) {
      const sorted = [...events].sort(
        (a, b) => magValue(a.magnitude) - magValue(b.magnitude),
      );
      for (const ev of sorted) {
        const age = eventAge01(ev.time, tRange.tMin, tRange.tMax);
        L.circleMarker([ev.latitude, ev.longitude], {
          radius: Math.max(2, leafletMagRadius(ev.magnitude) * 0.55),
          color: "rgba(0,0,0,0.2)",
          weight: 0.5,
          fillColor: timeAgeColor(age),
          fillOpacity: 0.35,
        }).addTo(group);
      }
      }

      // Stress nodes — numbered AMBER BADGES (shape ≠ fracture lines)
      if (vis.nodes) stressNodes.forEach((sn) => {
        const sel = sn.id === selectedNodeId;
        const size = sel ? 30 : 24;
        const fill = sn.score >= 70 ? "#ff8f00" : sn.score >= 55 ? C.nodeFill : "#ffe082";
        const ring = sel ? C.nodeSel : "#1a1200";
        const icon = L.divIcon({
          className: "supt-node-badge",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${fill};border:2.5px solid ${ring};
            box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.35);
            display:flex;align-items:center;justify-content:center;
            font:800 11px/1 ui-monospace,monospace;color:#1a1200;
          ">${sn.rank}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([sn.location.lat, sn.location.lon], {
          icon,
          zIndexOffset: 800 + (20 - sn.rank),
        });
        const tip =
          `<div style="font:12px/1.35 ui-sans-serif,system-ui;min-width:200px">` +
          `<strong style="color:#e65100">Stress node #${sn.rank}</strong>` +
          ` <span style="opacity:.7">score ${sn.score}/100</span><br/>` +
          `<span style="opacity:.85">${sn.depthKm.toFixed(1)} km · n=${sn.eventCount} · max M${sn.maxMag.toFixed(1)}</span>` +
          `</div>`;
        marker.bindTooltip(tip, { direction: "top", opacity: 0.96 });
        marker.bindPopup(stressNodePopupHtml(sn), {
          maxWidth: 320,
          className: "supt-node-popup",
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectNode?.(sn.id);
        });
        marker.addTo(group);
      });
    }
    drawRef.current = draw;

    async function init() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        preferCanvas: true,
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(basemapTileUrl("voyager"), {
        ...basemapTileOptions("voyager"),
        attribution: basemapTileOptions("voyager").attribution + " · SUPT overlay SES",
      }).addTo(map);

      const view = node.mapView ?? node.bbox;
      const pad = node.mapPad ?? 0.015;
      map.fitBounds(
        L.latLngBounds(
          [view.minLat - pad, view.minLon - pad],
          [view.maxLat + pad, view.maxLon + pad],
        ),
        {
          padding: [16, 16],
          maxZoom: node.id === "japan" ? 13 : 8,
        },
      );

      if (node.volcano?.outline && node.volcano.outline.length > 2) {
        const ring = node.volcano.outline.map(
          ([lon, lat]) => [lat, lon] as [number, number],
        );
        L.polygon(ring, {
          color: "#1565c0",
          weight: 1.5,
          dashArray: "5 4",
          fillColor: "#1976d2",
          fillOpacity: 0.05,
        }).addTo(map);
      }

      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => {
        map.invalidateSize();
        void draw();
      }, 80);
    }

    void init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  useEffect(() => {
    void drawRef.current();
  }, [events, planes, stressNodes, lineaments, migration, stressField, selectedNodeId, tRange, layers]);

  const fittedFabric = useRef(false);
  useEffect(() => {
    if (fittedFabric.current) return;
    if (stressNodes.length < 1) return;
    fittedFabric.current = true;
    void fitToFabric();
  }, [stressNodes, fitToFabric]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize({ animate: false });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  const shellStyle = fullscreen
    ? undefined
    : typeof height === "number"
      ? { height }
      : { height };

  const C = SUPT_LAYER_COLORS;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#d8e0e8]",
        fullscreen
          ? "fixed inset-0 z-[100] rounded-none"
          : "h-full w-full rounded-lg",
        className,
      )}
      style={shellStyle}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {showControls && !fullscreen && (
        <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => void goHome()}
            title="Home (H) — focus caldera"
          >
            <Home className="size-3.5" />
            Home
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => void fitToFabric()}
            title="Frame stress nodes & fractures (G)"
          >
            Frame
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 border border-border bg-card/95 px-2 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => setFs(true)}
            title="Fullscreen (F)"
          >
            <Expand className="size-3.5" />
            Full
          </Button>
          <Button
            type="button"
            size="sm"
            variant={helpOpen ? "default" : "secondary"}
            className="h-8 w-8 border border-border bg-card/95 px-0 shadow-md"
            onClick={() => setHelpOpen((v) => !v)}
            title="Keys (?)"
          >
            <HelpCircle className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Fullscreen: clear Close + Reset — top bar, large touch targets */}
      {fullscreen && (
        <>
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent px-2 pb-8 pt-2 sm:px-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-10 min-w-[7.5rem] gap-1.5 border border-white/25 bg-card px-3 text-xs font-semibold shadow-lg"
                onClick={() => void goHome()}
                title="Reset view to caldera (H)"
              >
                <Home className="size-4" />
                Reset view
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-10 gap-1.5 border border-white/25 bg-card px-3 text-xs font-medium shadow-lg"
                onClick={() => void fitToFabric()}
                title="Frame stress & fractures (G)"
              >
                Frame nodes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={helpOpen ? "default" : "secondary"}
                className="h-10 w-10 border border-white/25 bg-card px-0 shadow-lg"
                onClick={() => setHelpOpen((v) => !v)}
                title="Keys (?)"
              >
                <HelpCircle className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-11 min-w-[6.5rem] gap-2 border-2 border-white/40 bg-foreground px-4 text-sm font-bold text-background shadow-xl hover:bg-foreground/90"
              onClick={() => setFs(false)}
              title="Close fullscreen (Esc)"
            >
              <X className="size-5 stroke-[2.5]" />
              Close
            </Button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/80 bg-card/95 px-3 py-1 font-mono text-[10px] text-muted-foreground shadow-md backdrop-blur-sm">
            {node.code} · Esc closes · H resets
          </div>
        </>
      )}

      {/* Layers: collapsed chip by default (mobile-safe); expands on tap */}
      <div className="absolute bottom-3 left-3 z-20 max-w-[min(200px,calc(100vw-1.5rem))]">
        {!layersOpen ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 gap-1.5 border border-border bg-card/95 px-2.5 text-[11px] shadow-md backdrop-blur-sm"
            onClick={() => setLayersOpen(true)}
            title="Layers (L)"
            aria-expanded={false}
          >
            <Layers className="size-3.5" />
            Layers
          </Button>
        ) : (
          <div className="rounded-md border border-border bg-card/98 p-2 text-[10px] shadow-lg backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground">Layers · tap to toggle</span>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Collapse layers (Esc)"
                aria-label="Collapse layers"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
            <div className="flex max-h-[min(50vh,320px)] flex-col gap-0.5 overflow-y-auto">
              <LayerToggle
                on={layers.nodes}
                onClick={() => toggleLayer("nodes")}
                glyph={<GlyphNode />}
                label="Stress nodes"
                hint="numbered amber discs"
              />
              <LayerToggle
                on={layers.fractures}
                onClick={() => toggleLayer("fractures")}
                glyph={<GlyphLine color={C.fracture} />}
                label="Fracture planes"
                hint="magenta lines"
              />
              <LayerToggle
                on={layers.axes}
                onClick={() => toggleLayer("axes")}
                glyph={<GlyphAxes />}
                label="σ axes"
                hint="black ∥ · blue ⊥"
              />
              <LayerToggle
                on={layers.lineaments}
                onClick={() => toggleLayer("lineaments")}
                glyph={<GlyphDash color={C.lineament} />}
                label="Lineaments"
                hint="indigo dashed"
              />
              <LayerToggle
                on={layers.migration}
                onClick={() => toggleLayer("migration")}
                glyph={<GlyphLine color={C.migration} thick />}
                label="Migration"
                hint="teal path"
              />
              <LayerToggle
                on={layers.field}
                onClick={() => toggleLayer("field")}
                glyph={<GlyphBlob color={C.fieldMid} />}
                label="Stress field"
                hint="violet density glow"
              />
              <LayerToggle
                on={layers.events}
                onClick={() => toggleLayer("events")}
                glyph={<GlyphDot />}
                label="Earthquakes"
                hint="small age dots"
              />
            </div>
          </div>
        )}
      </div>

      {helpOpen && (
        <div className="absolute inset-x-2 bottom-16 z-30 mx-auto max-w-md rounded-lg border border-border bg-card/98 p-3 text-xs shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-3 sm:right-auto">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Keyboard · Stress map</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setHelpOpen(false)}
            >
              Close
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-accent">H</dt>
            <dd>Home — node caldera / arc frame</dd>
            <dt className="text-accent">G</dt>
            <dd>Frame — fit stress nodes + fractures</dd>
            <dt className="text-accent">F</dt>
            <dd>Toggle fullscreen</dd>
            <dt className="text-accent">L</dt>
            <dd>Toggle layers panel</dd>
            <dt className="text-accent">+ / −</dt>
            <dd>Zoom in / out</dd>
            <dt className="text-accent">Esc</dt>
            <dd>Close layers / help / exit fullscreen</dd>
            <dt className="text-accent">?</dt>
            <dd>This help</dd>
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Amber numbered discs = stress nodes. Magenta lines = fracture planes. Tap legend to
            isolate layers. Co-location is observational — not a forecast.
          </p>
        </div>
      )}
    </div>
  );
}

function LayerToggle({
  on,
  onClick,
  glyph,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  glyph: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors",
        on ? "bg-secondary/60 text-foreground" : "text-muted-foreground opacity-55 line-through",
      )}
      title={on ? `Hide ${label}` : `Show ${label}`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{glyph}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium leading-tight">{label}</span>
        <span className="block text-[9px] leading-tight opacity-70">{hint}</span>
      </span>
      <span className="font-mono text-[9px] opacity-60">{on ? "on" : "off"}</span>
    </button>
  );
}

function GlyphNode() {
  return (
    <span
      className="flex size-4 items-center justify-center rounded-full border-2 border-black bg-[#ffb300] text-[8px] font-bold text-black shadow-[0_0_0_1px_#fff]"
      aria-hidden
    >
      1
    </span>
  );
}

function GlyphLine({ color, thick }: { color: string; thick?: boolean }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1"
        y1="5"
        x2="17"
        y2="5"
        stroke={color}
        strokeWidth={thick ? 3 : 2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphDash({ color }: { color: string }) {
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
      <line
        x1="1"
        y1="5"
        x2="17"
        y2="5"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="3 2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphAxes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <line x1="2" y1="8" x2="14" y2="8" stroke="#212121" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="14" stroke="#1565c0" strokeWidth="2" strokeDasharray="2 1" />
    </svg>
  );
}

function GlyphBlob({ color }: { color: string }) {
  return (
    <span
      className="size-4 rounded-full opacity-80"
      style={{ background: color }}
      aria-hidden
    />
  );
}

function GlyphDot() {
  return <span className="size-2 rounded-full bg-neutral-500" aria-hidden />;
}

function stressNodePopupHtml(sn: StressNode): string {
  const b =
    sn.localBValue != null && Number.isFinite(sn.localBValue)
      ? sn.localBValue.toFixed(2)
      : "—";
  const near =
    sn.nearFractureId && sn.nearFractureDistKm != null
      ? `${sn.nearFractureDistKm.toFixed(2)} km to plane`
      : "no close plane (<0.8 km)";
  const energy =
    Number.isFinite(sn.energyDensity) ? sn.energyDensity.toFixed(2) : "—";
  const shallow =
    Number.isFinite(sn.shallowness) ? `${(sn.shallowness * 100).toFixed(0)}%` : "—";
  const meanM = Number.isFinite(sn.meanMag) ? sn.meanMag.toFixed(2) : "—";
  const lat = sn.location.lat.toFixed(4);
  const lon = sn.location.lon.toFixed(4);
  const priority =
    sn.score >= 75 ? "HIGH" : sn.score >= 55 ? "MODERATE" : "SECONDARY";
  const priColor =
    sn.score >= 75 ? "#c62828" : sn.score >= 55 ? "#ef6c00" : "#546e7a";

  return `
  <div style="font:12px/1.45 ui-sans-serif,system-ui;color:#1a1a1a;max-width:300px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:#ffb300;border:2px solid #1a1200;align-items:center;justify-content:center;font:800 11px ui-monospace;box-shadow:0 0 0 1px #fff">${sn.rank}</span>
      <div>
        <div style="font-weight:700;font-size:13px">Stress node #${sn.rank}</div>
        <div style="font-size:10px;color:${priColor};font-weight:600">${priority} · score ${sn.score}/100</div>
      </div>
    </div>
    <p style="margin:0 0 8px;font-size:11px;color:#333">${sn.interpretation}</p>
    <table style="width:100%;border-collapse:collapse;font-family:ui-monospace,monospace;font-size:10px">
      <tr><td style="color:#666;padding:2px 6px 2px 0">Depth (mean)</td><td style="text-align:right;font-weight:600">${sn.depthKm.toFixed(2)} km</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Events in cell</td><td style="text-align:right;font-weight:600">${sn.eventCount}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Last 6h</td><td style="text-align:right;font-weight:600">${sn.recentCount6h}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Max / mean M</td><td style="text-align:right;font-weight:600">M${sn.maxMag.toFixed(1)} / ${meanM}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Energy density</td><td style="text-align:right;font-weight:600">${energy}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Shallowness</td><td style="text-align:right;font-weight:600">${shallow}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Local b-value</td><td style="text-align:right;font-weight:600">${b}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Near fracture</td><td style="text-align:right;font-weight:600">${near}</td></tr>
      <tr><td style="color:#666;padding:2px 6px 2px 0">Location</td><td style="text-align:right;font-weight:600">${lat}N ${lon}E</td></tr>
    </table>
    <p style="margin:8px 0 0;font-size:9px;color:#777;line-height:1.35">
      Score blends density, energy, shallowness & proximity to fitted planes.
      Preferential zone for continued activity in this window — not a forecast of the next epicentre.
    </p>
  </div>`;
}

function fieldColor(i: number): string {
  if (i >= 0.75) return SUPT_LAYER_COLORS.fieldHot;
  if (i >= 0.5) return SUPT_LAYER_COLORS.fieldMid;
  return SUPT_LAYER_COLORS.fieldCool;
}

/** Map-plane principal axes from fracture strike/dip (geometric proxy, not CMT). */
function drawStressAxes(
  L: typeof import("leaflet"),
  group: import("leaflet").LayerGroup,
  pl: FracturePlane,
  C: typeof SUPT_LAYER_COLORS,
) {
  const lat0 = (pl.centroid.lat * Math.PI) / 180;
  const kmN = 0.9; // half-length of axis ticks (km)
  const strike = (pl.strikeDeg * Math.PI) / 180;
  // Strike direction (along fracture, map horizontal)
  const dLatS = (kmN * Math.cos(strike)) / 110.574;
  const dLonS = (kmN * Math.sin(strike)) / (111.32 * Math.cos(lat0));
  // Normal in map plane (strike + 90°)
  const dLatN = (kmN * Math.cos(strike + Math.PI / 2)) / 110.574;
  const dLonN = (kmN * Math.sin(strike + Math.PI / 2)) / (111.32 * Math.cos(lat0));

  const c = pl.centroid;
  // σ∥ strike-parallel (black)
  L.polyline(
    [
      [c.lat - dLatS, c.lon - dLonS],
      [c.lat + dLatS, c.lon + dLonS],
    ],
    { color: C.sigmaParallel, weight: 2, opacity: 0.85 },
  )
    .bindTooltip(`σ∥ strike-parallel ~${pl.strikeDeg.toFixed(0)}° (fabric proxy)`)
    .addTo(group);

  // σ⊥ map-normal to strike (blue) — opening/compression orientation proxy
  L.polyline(
    [
      [c.lat - dLatN * 0.7, c.lon - dLonN * 0.7],
      [c.lat + dLatN * 0.7, c.lon + dLonN * 0.7],
    ],
    { color: C.sigmaNormal, weight: 2, opacity: 0.9, dashArray: "2 3" },
  )
    .bindTooltip(
      `σ⊥ horizontal normal to strike · dip ${pl.dipDeg.toFixed(0)}° plane (not a full tensor)`,
    )
    .addTo(group);
}
