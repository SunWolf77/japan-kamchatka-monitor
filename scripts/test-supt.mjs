/**
 * Live SUPT + fabric detective smoke test against GOSSIP 2026 catalog.
 */
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const GOSSIP = "https://terremoti.ov.ingv.it/gossip/flegrei/2026/events.csv";

writeFileSync(
  "/tmp/run-supt.ts",
  `
import { parseGossipCsv } from "/workspace/src/lib/seismic/providers/gossip.ts";
import { runSwarmDetective } from "/workspace/src/lib/supt/detective.ts";
import { getFocusNode } from "/workspace/src/lib/seismic/focus-nodes.ts";
import { analyzeSwarmActivity } from "/workspace/src/lib/seismic/swarm.ts";
import { runFullBacktest } from "/workspace/src/lib/supt/backtest.ts";

async function main() {
  // Frozen probe unit backtests (no network)
  const bt = runFullBacktest(40);
  console.log("BACKTEST", bt.summary);

  let text: string;
  try {
    const res = await fetch("${GOSSIP}");
    if (!res.ok) throw new Error("GOSSIP HTTP " + res.status);
    text = await res.text();
  } catch (e) {
    console.error("GOSSIP fetch failed", e);
    process.exit(bt.ok ? 0 : 1);
  }

  const all = parseGossipCsv(text);
  const now = Date.now();
  const week = all.filter((e) => e.time >= now - 7 * 864e5);
  const node = getFocusNode("campi-flegrei");
  const swarm = analyzeSwarmActivity(week);
  const report = runSwarmDetective(week, node, swarm);

  console.log(JSON.stringify({
    sample: report.sampleSize,
    methodology: report.methodologyLabel,
    resonance: {
      d: report.resonance.d_ij,
      band: report.resonance.band,
      z: report.resonance.z,
      separated: report.resonance.separated,
      n: report.resonance.n,
    },
    verdict: report.verdict.title,
    etas: report.etas.verdict,
    planes: report.fabric.planes.map((p) => ({
      label: p.label,
      conf: +p.confidence.toFixed(2),
      rms: +p.rmsKm.toFixed(2),
      n: p.support,
      strike: +p.strikeDeg.toFixed(0),
      dip: +p.dipDeg.toFixed(0),
    })),
    nodes: report.fabric.stressNodes.slice(0, 5).map((n) => ({
      rank: n.rank,
      score: n.score,
      lat: +n.location.lat.toFixed(4),
      lon: +n.location.lon.toFixed(4),
      d: +n.depthKm.toFixed(1),
    })),
    localProbes: report.localProbes.slice(0, 4).map((p) => ({
      rank: p.rank,
      d: p.resonance.d_ij,
      band: p.resonance.band,
      sep: p.resonance.separated,
      n: p.resonance.n,
    })),
    findings: report.findings.map((f) => f.title),
    summary: report.detectiveSummary,
  }, null, 2));

  process.exit(bt.ok ? 0 : 1);
}
main();
`,
);

// also write backtest locally for the runner
writeFileSync(
  "/workspace/src/lib/supt/backtest.ts",
  await (async () => {
    const r = await fetch(
      "https://raw.githubusercontent.com/SunWolf77/sun-earth-sentinel/main/src/lib/supt/backtest.ts",
    );
    return await r.text();
  })(),
);

const r = spawnSync("npx", ["--yes", "tsx", "/tmp/run-supt.ts"], {
  encoding: "utf8",
  cwd: "/workspace",
  timeout: 90000,
});
console.log(r.stdout);
console.error(r.stderr);
process.exit(r.status ?? 1);
