#!/usr/bin/env node
// Local testing:  node src/cli.js (--next | --blog-id <top_blogs id> | --blog <url> | --topic <id>) [--angle A|B|"custom angle"] [--no-upload]
import { parseArgs } from "node:util";
import { makeReel } from "./pipeline.js";

const { values } = parseArgs({
  options: {
    blog: { type: "string" },
    topic: { type: "string" },
    "blog-id": { type: "string" },
    next: { type: "boolean", default: false }, // what the daily plan would pick
    angle: { type: "string" },
    voice: { type: "string" },
    language: { type: "string" },
    "no-upload": { type: "boolean", default: false },
    out: { type: "string" },
  },
});

let topic = null;
if (values.topic) {
  const { loadTopics } = await import("./topics.js");
  topic = loadTopics().topics.find((t) => t.id === values.topic);
  if (!topic) { console.error(`unknown topic ${values.topic}`); process.exit(2); }
}
let blogRow = null;
if (values.next) {
  const { nextBlogJobs } = await import("./blogplan.js");
  const [job] = (await nextBlogJobs(1)).jobs;
  if (!job) { console.error("no top blog left to make a reel from"); process.exit(2); }
  console.error(`next: ${job.title} (angle ${job.angle}, ${job.clicks} clicks, ${job.impressions} impressions)`);
  values["blog-id"] = String(job.blog_id);
  values.angle ||= job.angle;
}
if (values["blog-id"]) {
  const { topBlogs } = await import("./storage.js");
  blogRow = (await topBlogs({ id: values["blog-id"] }))[0];
  if (!blogRow) { console.error(`unknown blog id ${values["blog-id"]}`); process.exit(2); }
}
if (!values.blog && !topic && !blogRow) {
  console.error('usage: node src/cli.js (--next | --blog-id <id> | --blog <url> | --topic <id>) [--angle A|B|C|D] [--language english|hindi] [--no-upload] [--voice <id>] [--out <dir>]');
  process.exit(2);
}

const result = await makeReel({
  blogUrl: values.blog,
  blogRow,
  topic,
  angle: values.angle || "A",
  voice: values.voice,
  language: values.language,
  upload: !values["no-upload"],
  outDir: values.out,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
