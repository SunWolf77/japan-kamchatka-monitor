import { useEffect, useMemo, useRef, useState } from "react";
import { BookMarked, BrainCircuit, Download, Upload, FileSpreadsheet } from "lucide-react";
import type { FocusNodeId, SwarmAnalysis } from "@/lib/seismic/types";
import type { ContinuumReport } from "@/lib/supt/continuum";
import type { SchumannSnapshot } from "@/lib/supt/schumann";
import {
  downloadEpochCsv,
  downloadEpochJson,
  getEpochMemory,
  importEpochJson,
  learnFromObservation,
  listEpochs,
  memoryInsight,
  type EpochEntry,
  type EpochMemory,
} from "@/lib/supt/epochLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: FocusNodeId;
  continuum: ContinuumReport | null;
  swarm: SwarmAnalysis;
  schumann?: SchumannSnapshot | null;
  density?: "full" | "compact";
  /** When false, only refresh display — parent runs learnFromObservation */
  enableLearn?: boolean;
  className?: string;
};

export function EpochLogPanel({
  nodeId,
  continuum,
  swarm,
  schumann,
  density = "full",
  enableLearn = true,
  className,
}: Props) {
  const [mem, setMem] = useState<EpochMemory>(() => getEpochMemory());
  const [flash, setFlash] = useState<string | null>(null);
  const [ioMsg, setIoMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const compact = density === "compact";

  useEffect(() => {
    if (!continuum) {
      setMem(getEpochMemory());
      return;
    }
    if (!enableLearn) {
      setMem(getEpochMemory());
      return;
    }
    const { memory, newEpoch, updated } = learnFromObservation({
      nodeId,
      continuum,
      swarm,
      schumann,
    });
    if (updated) {
      setMem({ ...memory, priors: { ...memory.priors }, learned: [...memory.learned] });
      if (newEpoch) {
        setFlash(newEpoch.title);
        const t = window.setTimeout(() => setFlash(null), 6000);
        return () => window.clearTimeout(t);
      }
    } else {
      setMem(getEpochMemory());
    }
  }, [nodeId, continuum, swarm, schumann, enableLearn]);

  // Poll memory when parent learns (Map-only sessions)
  useEffect(() => {
    if (enableLearn) return;
    const id = window.setInterval(() => setMem(getEpochMemory()), 4000);
    return () => window.clearInterval(id);
  }, [enableLearn]);

  const epochs = useMemo(() => listEpochs(mem), [mem]);
  const insight = useMemo(() => memoryInsight(mem), [mem]);
  const visible = compact ? epochs.slice(0, 4) : epochs;

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const res = importEpochJson(text);
      if (!res.ok) {
        setIoMsg(res.error);
        return;
      }
      setMem({
        ...res.memory,
        priors: { ...res.memory.priors },
        learned: [...res.memory.learned],
      });
      setIoMsg(`Imported · ${res.memory.learned.length} learned epochs`);
    } catch (e) {
      setIoMsg(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <Card className={cn("border-accent/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <BookMarked className="size-4 text-accent" />
          <CardTitle className="text-sm">
            {compact ? "Epoch memory" : "Epoch log · learning memory"}
          </CardTitle>
          <Badge variant="outline">{mem.learned.length} learned</Badge>
          {!compact && <Badge variant="secondary">{epochs.length} total</Badge>}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => {
                downloadEpochJson(nodeId);
                setIoMsg("JSON downloaded");
              }}
            >
              <Download className="size-3" />
              JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => {
                downloadEpochCsv(nodeId);
                setIoMsg("CSV downloaded");
              }}
            >
              <FileSpreadsheet className="size-3" />
              CSV
            </Button>
            {!compact && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-3" />
                  Import
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    void onImport(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>
        </div>
        {!compact && (
          <CardDescription>
            Seeded Harmonic Learning DB + live priors. JSON = full memory · CSV = spreadsheet /
            Notion paste.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {!compact && (
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer select-none px-2.5 py-2 font-medium text-foreground">
              How the harmonic learning DB works
            </summary>
            <div className="space-y-2 border-t border-border px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">Seeds</strong> = fixed Notion epochs.{" "}
                <strong className="text-foreground">Learned</strong> = live thresholds.{" "}
                <strong className="text-foreground">Priors</strong> update on every poll (even Map
                tab). Export JSON/CSV to keep memory across browsers.
              </p>
            </div>
          </details>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5">
          <BrainCircuit className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <p className="leading-relaxed text-muted-foreground">{insight}</p>
        </div>
        {flash && (
          <div className="rounded-md border border-warn/40 bg-warn/10 px-2.5 py-1.5 text-warn">
            New learned epoch: {flash}
          </div>
        )}
        {ioMsg && <p className="text-[11px] text-muted-foreground">{ioMsg}</p>}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini
            k="Elev. EII μ"
            v={
              mem.priors.elevatedSamples
                ? mem.priors.meanElevatedEii.toFixed(3)
                : "—"
            }
            h={`n=${mem.priors.elevatedSamples}`}
          />
          <Mini
            k="SR when elev."
            v={
              mem.priors.schumannSamples
                ? mem.priors.meanSchumannWhenElevated.toFixed(0)
                : "—"
            }
            h={`n=${mem.priors.schumannSamples}`}
          />
          <Mini
            k="Active shallow"
            v={
              mem.priors.activeSamples
                ? `${(mem.priors.meanShallowWhenActive * 100).toFixed(0)}%`
                : "—"
            }
            h={`n=${mem.priors.activeSamples}`}
          />
          <Mini
            k="SR×shallow"
            v={mem.priors.schumannShallowCoupling.toFixed(2)}
            h="coupling prior"
          />
        </div>

        <div
          className={cn(
            "space-y-1.5 overflow-y-auto pr-1",
            compact ? "max-h-[220px]" : "max-h-[360px]",
          )}
        >
          {visible.map((e) => (
            <EpochRow key={e.id} e={e} compact={compact} />
          ))}
          {compact && epochs.length > visible.length && (
            <p className="text-[10px] text-muted-foreground">
              +{epochs.length - visible.length} more in Feeds → Memory
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ k, v, h }: { k: string; v: string; h: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{v}</div>
      <div className="text-[10px] text-muted-foreground">{h}</div>
    </div>
  );
}

function EpochRow({ e, compact }: { e: EpochEntry; compact?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        e.source === "learned"
          ? "border-accent/35 bg-accent/5"
          : "border-border bg-secondary/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={
            e.source === "learned" ? "live" : e.source === "seed" ? "outline" : "secondary"
          }
        >
          {e.source}
        </Badge>
        {e.hits > 1 && (
          <Badge variant="warn" className="font-mono">
            ×{e.hits}
          </Badge>
        )}
        <span className="font-medium text-foreground">{e.title}</span>
        {!compact && (
          <span className="font-mono text-[10px] text-muted-foreground">{e.period}</span>
        )}
      </div>
      {!compact && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{e.signature}</p>
      )}
      {e.metrics && (
        <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
          EII {e.metrics.eii?.toFixed(3)} · SR {e.metrics.schumannIndex ?? "—"} · 6h{" "}
          {e.metrics.rate6h ?? "—"} · M{e.metrics.maxMag?.toFixed(1) ?? "—"}
        </p>
      )}
    </div>
  );
}
