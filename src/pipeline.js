import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { fetchBlog } from "./blog.js";
import { writeScript, factCheck, unsupportedNumbers, validateShape, scriptText, scriptPlain, romanize } from "./script.js";
import { speak, transcribe } from "./openrouter.js";
import { buildTimeline } from "./timing.js";
import { resolveVisuals } from "./visuals.js";
import { writeProject } from "./compose.js";
import { render, verify } from "./render.js";
import { uploadVideo, saveJob } from "./storage.js";
import { Costs, StepError, log, probeDuration, slugify, step } from "./util.js";

const LEAD = 0.1;
const TAIL = 0.9;
const PAUSE = 0.35;

/** Script + deterministic number guard + LLM fact check, with feedback-driven rewrites. */
async function scriptWithChecks(blog, angle, costs, opts = {}) {
  let feedback = opts.feedback || "";
  let lastIssues = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const { script, cost } = await writeScript(blog, angle, { feedback, targetWords: opts.targetWords });
    costs.add("script_llm", cost);
    const { errs, words } = validateShape(script);
    const bad = unsupportedNumbers(script, blog.text);
    if (bad.length) errs.push(`These numbers do not appear in the blog post, remove or correct them: ${bad.join(", ")}`);
    if (errs.length) { feedback = errs.join("\n"); lastIssues = errs; continue; }
    const fc = await factCheck(blog, script);
    costs.add("fact_check_llm", fc.cost);
    if (fc.ok) return { script, words };
    feedback = `Unsupported claims found by the fact checker:\n- ${fc.issues.join("\n- ")}`;
    lastIssues = fc.issues;
  }
  throw new StepError("fact_check", new Error(`script failed checks after 3 drafts: ${lastIssues.join(" | ").slice(0, 600)}`));
}

export async function makeReel({ blogUrl, angle = "A", upload = true, voice, outDir }) {
  const t0 = Date.now();
  const costs = new Costs();
  const angleKey = /^[AB]$/i.test(angle) ? angle.toUpperCase() : `custom-${slugify(angle).slice(0, 24)}`;
  const date = new Date().toISOString().slice(0, 10);
  const jobId = `${date}-${slugify(blogUrl)}-${angleKey}`;
  const dir = outDir || path.join(config.workDir, jobId);
  const projectDir = path.join(dir, "project");
  await mkdir(projectDir, { recursive: true });
  const base = { blog_url: blogUrl, angle: angleKey };
  if (upload) await saveJob({ ...base, status: "rendering", failed_step: null, error: null });

  try {
    const blog = await step("fetch_blog", () => fetchBlog(blogUrl));

    let { script } = await step("script", () => scriptWithChecks(blog, angle, costs), { retries: 0 });

    // Voice, with one length-correcting rewrite if the read lands outside 40-60s.
    let voicePath = path.join(projectDir, "voice.mp3");
    let audioDur;
    for (let pass = 0; pass < 3; pass++) {
      const text = scriptText(script);
      const { audio, cost } = await step("tts", () => speak(text, { voice }));
      costs.add("tts", cost);
      await writeFile(voicePath, audio);
      audioDur = await probeDuration(voicePath);
      const total = audioDur + LEAD + TAIL + PAUSE;
      log(`  voice ${audioDur.toFixed(1)}s -> reel ${total.toFixed(1)}s`);
      if (total >= config.minSeconds && total <= config.maxSeconds) break;
      if (pass === 2) throw new StepError("tts", new Error(`reel length ${total.toFixed(1)}s outside ${config.minSeconds}-${config.maxSeconds}s after rewrite`));
      const words = scriptPlain(script).split(/\s+/).length;
      const targetWords = Math.round(words * ((config.minSeconds + config.maxSeconds) / 2 - LEAD - TAIL - PAUSE) / audioDur);
      ({ script } = await step("script", () => scriptWithChecks(blog, angle, costs, { targetWords }), { retries: 0 }));
    }

    const stt = await step("timing", () => transcribe(voicePath));
    costs.add("stt", stt.cost);
    // Captions in Roman Hinglish (brand font is Latin-only; Roman is what Indian Shorts use).
    const roman = await step("captions", () => romanize(stt.words.map((w) => w.text)));
    costs.add("captions_llm", roman.cost);
    const capWords = roman.words ? stt.words.map((w, i) => ({ ...w, cap: roman.words[i] })) : stt.words;
    const timeline = buildTimeline(script, capWords, { audioDuration: audioDur, lead: LEAD, tail: TAIL, pause: PAUSE });

    const { credits } = await step("assets", () => resolveVisuals(timeline.shots, projectDir));

    const bed = angleKey === "B" ? "bed_b" : "bed_a";
    await step("compose", () => writeProject(projectDir, { timeline, title: script.title, bed }), { retries: 0 });

    const mp4 = path.join(dir, `${jobId}.mp4`);
    const renderSeconds = await step("render", () => render(projectDir, mp4));
    const { duration } = await step("verify", () => verify(mp4), { retries: 0 });

    let videoUrl = null;
    if (upload) videoUrl = await step("upload", () => uploadVideo(mp4, `${date}/${slugify(blogUrl)}-${angleKey}.mp4`));

    const hashtags = (script.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`));
    const result = {
      ok: true,
      job_id: jobId,
      blog_url: blogUrl,
      blog_title: blog.title,
      angle: angleKey,
      title: script.title,
      script: scriptPlain(script),
      tts_input: scriptText(script),
      beats: script.beats.map((b) => ({ role: b.role, text: b.text, visual: b.visual })),
      caption: `${script.caption}\n\n${hashtags.join(" ")}`,
      hashtags,
      video_url: videoUrl,
      local_file: mp4,
      duration_s: Number(duration.toFixed(2)),
      hook_end_s: Number(timeline.hookEnd.toFixed(2)),
      hook_first_sentence_s: Number((LEAD + (stt.words.find((w) => /[.!?]$/.test(w.text)) || stt.words[0]).end).toFixed(2)),
      render_seconds: Math.round(renderSeconds),
      total_seconds: Math.round((Date.now() - t0) / 1000),
      cost_usd: costs.toJSON(),
      media_credits: credits,
    };
    await writeFile(path.join(dir, "report.json"), JSON.stringify(result, null, 2));
    if (upload) {
      await saveJob({
        ...base, status: "ready", title: result.title, script: result.script, caption: result.caption,
        hashtags: result.hashtags, video_url: videoUrl, duration_s: result.duration_s,
        cost_usd: costs.total, render_seconds: result.render_seconds, failed_step: null, error: null,
      });
    }
    log(`✅ ${jobId}: ${duration.toFixed(1)}s, render ${Math.round(renderSeconds)}s, cost $${costs.total.toFixed(4)}`);
    return result;
  } catch (e) {
    const failed = e instanceof StepError ? e.step : "unknown";
    const result = { ok: false, job_id: jobId, blog_url: blogUrl, angle: angleKey, failed_step: failed, error: e.message, cost_usd: costs.toJSON() };
    await writeFile(path.join(dir, "report.json"), JSON.stringify(result, null, 2)).catch(() => {});
    if (upload) await saveJob({ ...base, status: "failed", failed_step: failed, error: e.message.slice(0, 1000), cost_usd: costs.total });
    log(`❌ ${jobId} failed at ${failed}: ${e.message}`);
    return result;
  }
}
