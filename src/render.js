import path from "node:path";
import { config, ROOT } from "./config.js";
import { run } from "./util.js";

const HF = path.join(ROOT, "node_modules", ".bin", "hyperframes");

/** Render a HyperFrames project directory to MP4. Returns render seconds. */
export async function render(projectDir, outFile) {
  const t0 = Date.now();
  await run(HF, [
    "render", projectDir,
    "--output", outFile,
    "--fps", "30",
    "--quality", config.renderQuality,
    "--workers", String(config.renderWorkers),
  ], { cwd: projectDir, env: { HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_NO_UPDATE_CHECK: "1", CI: "1" } });
  return (Date.now() - t0) / 1000;
}

/** Sanity-check the output: size, duration window, audio present. */
export async function verify(file, maxSeconds = config.maxSeconds) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  const duration = Number(j.format.duration);
  const problems = [];
  if (!v || v.width !== 1080 || v.height !== 1920) problems.push(`bad video stream ${v?.width}x${v?.height}`);
  if (!a) problems.push("no audio stream");
  if (duration < config.minSeconds - 0.5 || duration > maxSeconds + 0.5) problems.push(`duration ${duration.toFixed(1)}s`);
  if (problems.length) throw new Error(`output check failed: ${problems.join(", ")}`);
  return { duration };
}
