/**
 * Campi Flegrei SUPT swarm detective
 * ----------------------------------
 * Layers:
 *  1. SUPT raw-gap resonance (frozen Sheppard probe)
 *  2. ETAS residual control
 *  3. Active-swarm subset resonance
 *  4. Fabric: PCA planes, stress nodes
 *  5. Local SUPT probes at stress cells
 *  6. Continuum v6.6 — EII / RPAM / CCI + NOAA Kp  (SunWolf-SUPT)
 *  7. Comparative harmonic fingerprint + ψ-fold tags
 *     (SUPT-Comparative-Harmonic-System, catalog-adapted)
 *
 * Not a forecast / not a civil-protection product.
 */

import {
  interEventSeconds,
  readingSummary,
  readingSummaryTech,
  resonanceScore,
  resonanceVerdict,
  type ResonanceScore,
} from "@/lib/supt/probe";
import {
  etasWhitenResiduals,
  interpretEtasControl,
  type EtasControlReading,
} from "@/lib/supt/etasWhiten";
import {
  runSuptAnalysis,
  type FracturePlane,
  type Lineament,
  type MigrationStep,
  type StressNode,
  type SuptFinding,
  type SuptReport,
} from "@/lib/seismic/supt";
import type { FocusNode, QuakeEvent, SwarmAnalysis } from "@/lib/seismic/types";
import { resolveClusterEvents } from "@/lib/seismic/types";
import { magValue } from "@/lib/utils";
import {
  buildContinuumReport,
  type ContinuumReport,
} from "@/lib/supt/continuum";
import {
  buildHarmonicReport,
  type HarmonicReport,
} from "@/lib/supt/harmonic";
import type { KpSnapshot } from "@/lib/supt/kp";
import type { SpaceWeatherSnapshot } from "@/lib/supt/spaceWeather";
import type { SchumannSnapshot } from "@/lib/supt/schumann";

export type LocalNodeProbe = {
  nodeId: string;
  rank: number;
  score: number;
  location: StressNode["location"];
  depthKm: number;
  eventCount: number;
  resonance: ResonanceScore;
  radiusKm: number;
};

export type SwarmDetectiveReport = {
  methodology: "SUPT";
  methodologyLabel: string;
  copyright: string;
  generatedAt: number;
  sampleSize: number;
  window: { start: number; end: number };

  resonance: ResonanceScore;
  reading: string;
  readingTech: string;
  verdict: ReturnType<typeof resonanceVerdict>;

  swarmResonance: ResonanceScore | null;
  swarmReading: string | null;

  etas: EtasControlReading & { nEvents: number };

  fabric: {
    planes: FracturePlane[];
    lineaments: Lineament[];
    stressNodes: StressNode[];
    stressField: SuptReport["targets"]["stressField"];
    migration: MigrationStep[];
    planarityIndex: number;
    elongationAzimuthDeg: number | null;
    cloudAxesKm: [number, number, number];
    unfold: SuptReport["unfold"];
  };

  localProbes: LocalNodeProbe[];

  /** Continuum v6.6 coupling metrics */
  continuum: ContinuumReport;
  /** Comparative harmonic fingerprint + ψ-fold */
  harmonic: HarmonicReport;

  findings: SuptFinding[];
  detectiveSummary: string;
};

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function eventsNear(
  events: QuakeEvent[],
  center: { lat: number; lon: number },
  radiusKm: number,
): QuakeEvent[] {
  return events.filter(
    (e) =>
      haversineKm(center, { lat: e.latitude, lon: e.longitude }) <= radiusKm,
  );
}

function composeDetectiveFindings(
  report: Omit<SwarmDetectiveReport, "findings" | "detectiveSummary">,
): { findings: SuptFinding[]; summary: string } {
  const findings: SuptFinding[] = [];
  const { continuum, harmonic, fabric, resonance, etas } = report;

  if (resonance.separated && resonance.d_ij != null) {
    findings.push({
      id: "supt-sep",
      severity: resonance.band === "CLUTCH" || resonance.band === "COHERENCE" ? "alert" : "watch",
      title: `SUPT ${resonance.band} · d=${resonance.d_ij.toFixed(3)}`,
      detail: report.reading,
    });
  }

  if (etas.verdict === "survives") {
    findings.push({
      id: "etas-survives",
      severity: "alert",
      title: "Timing structure survives ETAS whitening",
      detail: etas.plain,
    });
  }

  if (continuum.rpam === "ACTIVE") {
    findings.push({
      id: "eii-active",
      severity: "alert",
      title: `Continuum EII ${continuum.eii.toFixed(3)} · ${continuum.rpam}`,
      detail: continuum.diagnostic,
    });
  } else if (continuum.rpam === "ELEVATED") {
    findings.push({
      id: "eii-elevated",
      severity: "watch",
      title: `Continuum EII ${continuum.eii.toFixed(3)} · ${continuum.rpam}`,
      detail: continuum.diagnostic,
    });
  }

  if (continuum.cciLabel === "Coherent") {
    findings.push({
      id: "cci-coherent",
      severity: "watch",
      title: `CCI ${continuum.cci.toFixed(3)} · Coherent ψₛ–depth`,
      detail: continuum.geomagLabel,
    });
  }

  const bestHarm = harmonic.comparisons.reduce(
    (best, c) =>
      c.r != null && (best == null || Math.abs(c.r) > Math.abs(best))
        ? c.r
        : best,
    null as number | null,
  );
  if (bestHarm != null && Math.abs(bestHarm) >= 0.7) {
    findings.push({
      id: "harmonic-match",
      severity: Math.abs(bestHarm) >= 0.95 ? "watch" : "info",
      title: `Harmonic template r=${bestHarm.toFixed(3)}`,
      detail: harmonic.cascadeHint,
    });
  }

  if (fabric.unfold.rate6h >= 50) {
    findings.push({
      id: "rate",
      severity: "alert",
      title: `Elevated rate: ${fabric.unfold.rate6h} events / 6 h`,
      detail: `Cadence ${fabric.unfold.rate1h}/h last hour.`,
    });
  }

  if (fabric.unfold.globalBValue != null && fabric.unfold.globalBValue < 0.9) {
    findings.push({
      id: "bval",
      severity: fabric.unfold.globalBValue < 0.75 ? "alert" : "watch",
      title: `Low b-value ≈ ${fabric.unfold.globalBValue.toFixed(2)}`,
      detail:
        "MLE b depressed vs typical volcanic swarm (~1.0–1.2). High-stress fabric indicator.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      id: "quiet",
      severity: "info",
      title: "No strong detective signature",
      detail:
        "Widen the window, wait for denser swarm pulses, or drop min magnitude.",
    });
  }

  const topNode = fabric.stressNodes[0];
  const topPlane = fabric.planes[0];
  const summary = [
    `SUPT detective on ${report.sampleSize} hypocentres (Sheppard α=0.01).`,
    report.verdict.title + ".",
    `Continuum EII=${continuum.eii.toFixed(3)} (base ${continuum.eiiBase.toFixed(3)}, ${continuum.rpam}) · CCI=${continuum.cci.toFixed(3)} · Kp=${continuum.kp.toFixed(1)} · SR=${continuum.schumannIndex}.`,
    etas.verdict === "survives"
      ? "Timing survives ETAS residual whitening."
      : etas.verdict === "vanishes"
        ? "Raw timing vanishes under ETAS control."
        : "ETAS control null/insufficient.",
    topNode
      ? `Primary stress node @ ${topNode.location.lat.toFixed(3)}°N, ${topNode.location.lon.toFixed(3)}°E (score ${topNode.score}/100).`
      : "No dominant stress node.",
    topPlane
      ? `Fracture candidate ${topPlane.strikeDeg.toFixed(0)}°/${topPlane.dipDeg.toFixed(0)}°.`
      : "Cloud not planar enough for a fracture pick.",
    harmonic.cascadeHint,
  ].join(" ");

  return { findings, summary };
}

/**
 * Full SUPT + Continuum + harmonic detective investigation.
 */
export function runSwarmDetective(
  events: QuakeEvent[],
  node: FocusNode,
  swarm?: SwarmAnalysis,
  now = Date.now(),
  spaceWeather?: SpaceWeatherSnapshot | KpSnapshot | null,
  schumann?: SchumannSnapshot | null,
): SwarmDetectiveReport {
  const sample = events.filter(
    (e) =>
      Number.isFinite(e.latitude) &&
      Number.isFinite(e.longitude) &&
      Math.abs(e.latitude) > 0.1,
  );

  // 1. Global SUPT on inter-event gaps
  const gaps = interEventSeconds(sample.map((e) => e.time));
  const resonance = resonanceScore(gaps, sample.length > 400 ? 60 : 80);
  const reading = readingSummary(resonance);
  const readingTech = readingSummaryTech(resonance);
  const verdict = resonanceVerdict(resonance);

  // 2. ETAS residual control
  const etasEvents = sample
    .filter((e) => e.magnitude != null && Number.isFinite(e.magnitude))
    .map((e) => ({ tMs: e.time, mag: magValue(e.magnitude) }));
  const wh = etasWhitenResiduals(etasEvents);
  const rawPair = {
    d_ij: resonance.d_ij,
    separated: resonance.separated,
  };
  let etas: EtasControlReading & { nEvents: number };
  if (!wh.ok) {
    etas = {
      ...interpretEtasControl(rawPair, { d_ij: null, separated: false }, {
        forceInsufficient: true,
        reason: wh.reason,
        note: wh.note,
      }),
      nEvents: wh.nEvents,
    };
  } else {
    const whiteScore = resonanceScore(wh.residualGaps, 60);
    const whitePair = {
      d_ij: whiteScore.d_ij,
      separated: whiteScore.separated,
    };
    if (whiteScore.d_ij == null) {
      etas = {
        ...interpretEtasControl(rawPair, whitePair, {
          forceInsufficient: true,
          reason: "probe-null",
          note: "Insufficient — whitened probe null after residual transform.",
        }),
        nEvents: wh.nEvents,
      };
    } else {
      etas = { ...interpretEtasControl(rawPair, whitePair), nEvents: wh.nEvents };
    }
  }

  // 3. Active swarm subset resonance
  let swarmResonance: ResonanceScore | null = null;
  let swarmReading: string | null = null;
  const activeEv = resolveClusterEvents(swarm?.active, sample);

  if (activeEv.length >= 5) {
    const sg = interEventSeconds(activeEv.map((e) => e.time));
    swarmResonance = resonanceScore(sg, 50);
    swarmReading = readingSummary(swarmResonance);
  }

  // 4. Fabric
  const fabricReport = runSuptAnalysis(sample, node, swarm, now);

  // 5. Local SUPT probes
  const localProbes: LocalNodeProbe[] = [];
  const radiusKm = Math.max(0.6, Math.min(1.8, node.mapPad * 50));
  for (const sn of fabricReport.targets.stressNodes.slice(0, 6)) {
    const local = eventsNear(sample, sn.location, radiusKm);
    const lg = interEventSeconds(local.map((e) => e.time));
    const lr = resonanceScore(lg, 40);
    localProbes.push({
      nodeId: sn.id,
      rank: sn.rank,
      score: sn.score,
      location: sn.location,
      depthKm: sn.depthKm,
      eventCount: local.length,
      resonance: lr,
      radiusKm,
    });
  }

  // 6–7. Continuum (ReSunance v6.5 + Schumann EII) + Comparative Harmonic
  const continuum = buildContinuumReport(
    sample,
    spaceWeather ?? null,
    now,
    schumann ?? null,
  );
  const harmonic = buildHarmonicReport(sample, now);

  const tStart = sample.length ? Math.min(...sample.map((e) => e.time)) : now;
  const tEnd = sample.length ? Math.max(...sample.map((e) => e.time)) : now;

  const partial: Omit<SwarmDetectiveReport, "findings" | "detectiveSummary"> = {
    methodology: "SUPT",
    methodologyLabel:
      "Sheppard SUPT · ReSunance Continuum · Comparative Harmonic",
    copyright:
      "Sheppard's Universal Proxy Theory · U.S. Copyright TXu 2-468-771 (effective 2025-01-20) · SunWolf ReSunance Continuum / Comparative Harmonic ports",
    generatedAt: now,
    sampleSize: sample.length,
    window: { start: tStart, end: tEnd },
    resonance,
    reading,
    readingTech,
    verdict,
    swarmResonance,
    swarmReading,
    etas,
    fabric: {
      planes: fabricReport.patterns.planes,
      lineaments: fabricReport.patterns.lineaments,
      stressNodes: fabricReport.targets.stressNodes,
      stressField: fabricReport.targets.stressField,
      migration: fabricReport.unfold.migration,
      planarityIndex: fabricReport.patterns.planarityIndex,
      elongationAzimuthDeg: fabricReport.patterns.elongationAzimuthDeg,
      cloudAxesKm: fabricReport.patterns.cloudAxesKm,
      unfold: fabricReport.unfold,
    },
    localProbes,
    continuum,
    harmonic,
  };

  const { findings, summary } = composeDetectiveFindings(partial);

  return {
    ...partial,
    findings,
    detectiveSummary: summary,
  };
}
