#!/usr/bin/env node
// Local testing:  node src/cli.js --blog <url> --angle A|B|"custom angle" [--no-upload] [--voice <id>]
import { parseArgs } from "node:util";
import { makeReel } from "./pipeline.js";

const { values } = parseArgs({
  options: {
    blog: { type: "string" },
    topic: { type: "string" },
    angle: { type: "string", default: "A" },
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
if (!values.blog && !topic) {
  console.error('usage: node src/cli.js (--blog <url> | --topic <id>) [--angle A|B|C|D] [--language english|hindi] [--no-upload] [--voice <id>] [--out <dir>]');
  process.exit(2);
}

const result = await makeReel({
  blogUrl: values.blog,
  topic,
  angle: values.angle,
  voice: values.voice,
  language: values.language,
  upload: !values["no-upload"],
  outDir: values.out,
});
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
