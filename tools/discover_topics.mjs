#!/usr/bin/env node
// Builds the ranked reel-topic bank from real demand signals.
//   NODE_USE_ENV_PROXY=1 node tools/discover_topics.mjs            # full run -> config/topics.json
//   node tools/discover_topics.mjs --collect-only                   # collectors only, no LLM clustering
//   node tools/discover_topics.mjs --only autocomplete,competitor --collect-only
//   node tools/discover_topics.mjs --out cache/topics.json --target 70
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, config } from "../src/config.js";
import { discoverTopics } from "../src/topics.js";
import { log } from "../src/util.js";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const collectOnly = args.includes("--collect-only");
const out = path.resolve(ROOT, opt("--out", "config/topics.json"));
const only = opt("--only", null)?.split(",");
const target = Number(opt("--target", 72));

const t0 = Date.now();
const { topics, stats, cost, signals, signalText } = await discoverTopics({ log, target, cluster: !collectOnly, only });

// Debug dump of the (already anonymised) signals, kept out of git in cache/.
mkdirSync(config.cacheDir, { recursive: true });
writeFileSync(path.join(config.cacheDir, "topic-signals.json"), JSON.stringify({ stats, signals }, null, 1));
writeFileSync(path.join(config.cacheDir, "topic-signals.txt"), signalText);

if (collectOnly) {
  console.log(JSON.stringify(stats, null, 2));
  console.log(`signal text: ${signalText.length} chars -> ${path.join(config.cacheDir, "topic-signals.txt")}`);
  process.exit(0);
}

const doc = {
  generated_at: new Date().toISOString(),
  runtime_seconds: Math.round((Date.now() - t0) / 1000),
  count: topics.length,
  stats,
  cost,
  priority_formula: "signal_score + 0.9*min(distinct_sources,6) + 0.5 if autocomplete&youtube + 1 if sales_calls + audience weight (founder 1.5, ceo 1.2, finance_head 1.0, accountant 0.6) + 0.3 if evergreen",
  topics,
};
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");

const pad = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s).padEnd(n));
console.log(`\nTop 25 of ${topics.length} topics -> ${path.relative(ROOT, out)}\n`);
console.log(`${pad("#", 3)} ${pad("title", 58)} ${pad("aia_fit", 9)} ${pad("sources", 44)} ${pad("score", 5)} prio`);
for (const t of topics.slice(0, 25)) {
  console.log(`${pad(t.rank, 3)} ${pad(t.title, 58)} ${pad(t.aia_fit, 9)} ${pad(t.evidence.sources.join(","), 44)} ${pad(t.evidence.signal_score, 5)} ${t.priority}`);
}
console.log(`\naia_fit mix: ${JSON.stringify(stats.clustering.aia_fit)}`);
console.log(`cost: ${JSON.stringify(cost)}`);
const failed = Object.entries(stats).filter(([, s]) => s.ok === false);
if (failed.length) console.log(`failed sources: ${failed.map(([k, s]) => `${k} (${s.error})`).join("; ")}`);
