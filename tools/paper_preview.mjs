#!/usr/bin/env node
// Renders the paper number visuals (no API calls): node tools/paper_preview.mjs [outDir]
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { writeProject } from "../src/compose.js";
import { render } from "../src/render.js";
import { ROOT } from "../src/config.js";

const out = process.argv[2] || path.join(ROOT, "out", "paper-preview");
const V = [
  [{ type: "stat", value: "₹2.3 lakh", label: "GST notice, one missed check" }, 3.2],
  [{ type: "scene", scene: "paper_math", params: { title: "Where the credit went", rows: [{ label: "GST paid on bills", value: "₹1,80,000" }, { label: "Bills missing in 2B", value: "₹42,000" }], op: "-", result: { label: "Credit you can claim", value: "₹1,38,000" }, note: "the rest waits for your supplier" } }, 5.5],
  [{ type: "scene", scene: "paper_math", params: { rows: [{ label: "Bills a month", value: "300" }, { label: "Minutes per bill", value: "4" }], op: "x", result: { label: "Typing time", value: "20 hours" } } }, 4.2],
  [{ type: "stat", value: "45 days", label: "to pay an MSME supplier" }, 2.6],
];
let t = 0;
const shots = V.map(([visual, d]) => { const s = { visual, role: "story", start: t, end: t + d, beatText: "" }; t += d; return s; });
const total = t;
await mkdir(out, { recursive: true });
await copyFile(path.join(ROOT, "template", "assets", "audio", "bed_a.mp3"), path.join(out, "voice.mp3"));
await writeProject(out, {
  title: "Paper preview", bed: "bed_b",
  timeline: { total, lead: 0, voice: [{ start: 0, mediaStart: 0, duration: total }], twistAt: null, shots,
    captions: [{ start: 1, end: 3, words: [{ text: "THAT'S", start: 1, end: 1.4 }, { text: "₹2.3", start: 1.4, end: 1.9, hot: true }, { text: "LAKH", start: 1.9, end: 2.5 }] }], beats: [], hookEnd: 0 },
});
const secs = await render(out, path.join(out, "paper-preview.mp4"));
console.log("rendered in", secs, "s ->", path.join(out, "paper-preview.mp4"));
