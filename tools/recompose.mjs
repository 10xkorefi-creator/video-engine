#!/usr/bin/env node
// Re-compose and re-render a reel from its saved timeline (no API calls): node tools/recompose.mjs <reelDir>
import path from "node:path";
import { readFile } from "node:fs/promises";
import { writeProject } from "../src/compose.js";
import { render } from "../src/render.js";

const dir = path.resolve(process.argv[2]);
const saved = JSON.parse(await readFile(path.join(dir, "project", "timeline.json"), "utf8"));
saved.timeline.shots.forEach((s) => delete s.paper);
await writeProject(path.join(dir, "project"), saved);
const out = path.join(dir, "recomposed.mp4");
console.log("rendered in", Math.round(await render(path.join(dir, "project"), out)), "s ->", out);
