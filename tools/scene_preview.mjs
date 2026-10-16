#!/usr/bin/env node
// Renders every scene in the library back-to-back (no API calls): node tools/scene_preview.mjs [outDir]
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { writeProject } from "../src/compose.js";
import { render } from "../src/render.js";
import { ROOT } from "../src/config.js";

const out = process.argv[2] || path.join(ROOT, "out", "scene-preview");
const V = [
  { type: "scene", scene: "bills_flow", params: { title: "300 bills, zero typing", items: ["Raw material", "Freight", "Packaging", "Electricity"] } },
  { type: "scene", scene: "bank_match", params: {} },
  { type: "scene", scene: "gst_match", params: { mismatch_label: "Not in 2B" } },
  { type: "scene", scene: "whatsapp", params: { question: "Aaj kitna cash hai?", answer: "Bank balance aur pending dues, sab yahan 👇" } },
  { type: "scene", scene: "deadline", params: { month: "OCTOBER", day: 20, caption: "GSTR-3B due", stamp: "LATE" } },
  { type: "scene", scene: "meter", params: { value: "₹50", unit: "per day", label: "Late fee keeps running" } },
  { type: "scene", scene: "split", params: { left_title: "Founder A", right_title: "Founder B", left_points: ["Types every bill", "Misses deadlines"], right_points: ["AI reads bills", "Team approves"] } },
  { type: "scene", scene: "flow", params: { title: "How it works", steps: ["Upload bill", "AI reads", "Team approves", "Tally"] } },
];
const per = 3.2;
const shots = V.map((visual, i) => ({ visual, role: "story", start: i * per, end: (i + 1) * per, beatText: "" }));
const total = shots.length * per;
await mkdir(out, { recursive: true });
await copyFile(path.join(ROOT, "template", "assets", "audio", "bed_a.mp3"), path.join(out, "voice.mp3"));
await writeProject(out, {
  title: "Scene preview", bed: "bed_b",
  timeline: { total, lead: 0, voice: [{ start: 0, mediaStart: 0, duration: total }], twistAt: null, shots, captions: [], beats: [], hookEnd: 0 },
});
const secs = await render(out, path.join(out, "scene-preview.mp4"));
console.log("rendered in", secs, "s ->", path.join(out, "scene-preview.mp4"));
