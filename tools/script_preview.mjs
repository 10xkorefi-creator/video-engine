#!/usr/bin/env node
// Script-only preview (no voice, no render):  node tools/script_preview.mjs <blog_url> <A|B|C|D|"custom angle">
import { fetchBlog } from "../src/blog.js";
import { research } from "../src/research.js";
import { scriptWithChecks } from "../src/pipeline.js";
import { scriptPlain, stripTags } from "../src/script.js";
import { Costs } from "../src/util.js";

const [url, angle = "A"] = process.argv.slice(2);
const costs = new Costs();
const blog = await fetchBlog(url);
const r = await research(blog);
costs.add("research", r.cost);
const { script, plainIssues } = await scriptWithChecks(blog, angle, costs, { research: r });
console.log(JSON.stringify({
  blog: url, angle, length: script.length || "short", length_reason: script.length_reason, title: script.title, keyword: r.keyword,
  beats: script.beats.map((b) => ({ role: b.role, kind: b.kind, text: stripTags(b.text), tts: b.text, onScreen: b.visual?.value || b.visual?.query })),
  script: scriptPlain(script), caption: script.caption, hashtags: script.hashtags,
  sources: [...new Set(r.notes.map((n) => n.source_url))], blog_conflicts: r.conflicts,
  plain_issues_left: plainIssues, cost: costs.toJSON(),
}, null, 1));
