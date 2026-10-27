import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { fetchBlog } from "./blog.js";
import { research as doResearch, sourcesText } from "./research.js";
import { PRODUCT, stripTags, setLanguage, writeScript, factCheck, plainCheck, unsupportedNumbers, validateShape, scriptText, scriptPlain, romanize } from "./script.js";
import { speak, transcribe } from "./openrouter.js";
import { buildTimeline } from "./timing.js";
import { resolveVisuals } from "./visuals.js";
import { aiBroll } from "./aivideo.js";
import { writeProject } from "./compose.js";
import { render, verify } from "./render.js";
import { uploadVideo, saveJob } from "./storage.js";
import { Costs, StepError, log, probeDuration, run, slugify, step } from "./util.js";

const LEAD = 0.1;
const TAIL = 0.9;
const PAUSE = 0.25;

/** Script + deterministic number guard + LLM fact check, with feedback-driven rewrites. */
export async function scriptWithChecks(blog, angle, costs, opts = {}) {
  let feedback = opts.feedback || "";
  let lastIssues = [];
  let previous = opts.previous || null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { script, cost } = await writeScript(blog, angle, { feedback, targetWords: opts.targetWords, research: opts.research, previous });
    previous = script;
    costs.add("script_llm", cost);
    const { errs, words } = validateShape(script);
    const bad = unsupportedNumbers(script, sourcesText(blog, opts.research?.notes || []) + "\n" + PRODUCT);
    if (bad.length) errs.push(`These numbers do not appear in the blog post, remove or correct them: ${bad.join(", ")}`);
    // Word count is only a proxy: if length is the last problem left, let the measured voice decide (TTS loop trims).
    // Topics AI Accountant directly solves must stay on that problem and show AiA as the fix.
    if (blog.aiaFit === "direct" && !script.beats?.some((b) => b.role !== "cta" && /AI\s*Accountant/i.test(b.text || ""))) {
      errs.push(`Stay on this topic's problem (${blog.title}) and, inside the story, show AI Accountant as the smart founder's fix with one concrete thing it does (on top of Tally). Do not drift to a different rule or penalty.`);
    }
    const hard = errs.filter((e) => !e.startsWith("Too long") && !e.startsWith("Show the worked example") && !e.startsWith("Too many ideas") && !e.startsWith("Stay on this topic"));
    if (hard.length || (errs.length && attempt < 3)) { feedback = errs.join("\n"); lastIssues = errs; continue; }
    const [fc, pc] = await Promise.all([factCheck(blog, script, opts.research?.notes || []), plainCheck(script)]);
    costs.add("fact_check_llm", fc.cost + pc.cost);
    if (fc.ok && (pc.ok || attempt >= 2)) return { script, words, plainIssues: pc.issues };
    if (!fc.ok) {
    feedback = `Unsupported claims found by the fact checker:\n- ${fc.issues.join("\n- ")}`;
    lastIssues = fc.issues;
    } else {
      feedback = `Too technical for a founder with zero accounting knowledge. Rewrite these lines in plain everyday words (keep the story):\n- ${pc.issues.join("\n- ")}`;
    }
  }
  throw new StepError("fact_check", new Error(`script failed checks after 4 drafts: ${lastIssues.join(" | ").slice(0, 600)}`));
}

/** A topic from the topic bank becomes the "blog" (direction): its related blog if any, else a research brief. */
export async function sourceFor(topic, blogUrl) {
  if (!topic) return fetchBlog(blogUrl);
  const brief = [
    `TOPIC: ${topic.title}`, `PROBLEM: ${topic.problem || ""}`, `WHY IT MATTERS: ${topic.why_it_matters || ""}`,
    `WHAT PEOPLE ACTUALLY ASK: ${(topic.evidence?.examples || []).join(" | ")}`,
  ].join("\n");
  if (topic.related_blog) {
    try {
      const b = await fetchBlog(topic.related_blog);
      return { ...b, title: topic.title, aiaFit: topic.aia_fit, text: `${brief}\n\nRELATED AI ACCOUNTANT BLOG (${b.title}):\n${b.text}` };
    } catch {}
  }
  return { url: topic.related_blog || "https://www.aiaccountant.com", title: topic.title, aiaFit: topic.aia_fit, text: brief };
}

export async function makeReel({ blogUrl, topic, angle = "A", upload = true, voice, outDir, language }) {
  const t0 = Date.now();
  const lang = setLanguage(language);
  if (topic) blogUrl = `topic:${topic.id}`;
  const costs = new Costs();
  const angleKey = /^[ABCD]$/i.test(angle) ? angle.toUpperCase() : `custom-${slugify(angle).slice(0, 24)}`;
  const date = new Date().toISOString().slice(0, 10);
  const jobId = `${date}-${slugify(blogUrl)}-${angleKey}-${lang === "english" ? "en" : "hi"}`;
  const dir = outDir || path.join(config.workDir, jobId);
  const projectDir = path.join(dir, "project");
  await mkdir(projectDir, { recursive: true });
  const base = { blog_url: blogUrl, angle: angleKey, language: lang, topic: topic?.title || null };
  if (upload) await saveJob({ ...base, status: "rendering", failed_step: null, error: null });

  try {
    const blog = await step("fetch_blog", () => sourceFor(topic, blogUrl));

    // Research is best-effort: if web search fails we still write from the blog alone.
    let research = { keyword: blog.title, notes: [], conflicts: [] };
    try {
      const cacheFile = path.join(config.cacheDir, "research", `${date}-${slugify(blogUrl.replace(/^topic:/, "topic-"))}.json`);
      research = await readFile(cacheFile, "utf8").then(JSON.parse).catch(() => null);
      if (!research && config.researchResults > 0) {
        research = await step("research", () => doResearch(blog));
        costs.add("research_llm", research.cost);
        await mkdir(path.dirname(cacheFile), { recursive: true });
        await writeFile(cacheFile, JSON.stringify(research, null, 1));
      }
      research ||= { keyword: blog.title, notes: [], conflicts: [] };
    } catch (e) {
      log(`  research skipped: ${e.message}`);
      research = { keyword: blog.title, notes: [], conflicts: [] };
    }

    let { script } = await step("script", () => scriptWithChecks(blog, angle, costs, { research }), { retries: 0 });

    // Voice, with one length-correcting rewrite if the read lands outside 40-60s.
    let voicePath = path.join(projectDir, "voice.mp3");
    let audioDur;
    for (let pass = 0; pass < 3; pass++) {
      const text = scriptText(script);
      const en = lang === "english";
      const ttsModel = (en && config.ttsModelEn) || config.ttsModel;
      const ttsVoice = voice || (en && config.ttsVoiceEn) || config.ttsVoice;
      const { audio, cost } = await step("tts", () => speak(text, { model: ttsModel, voice: ttsVoice }));
      costs.add("tts", cost);
      await writeFile(voicePath, audio);
      // A touch faster than the raw read keeps Reels/Shorts pacing tight without sounding rushed.
      if (config.voiceSpeed !== 1) {
        const fast = path.join(projectDir, "voice_tempo.mp3");
        await run("ffmpeg", ["-y", "-v", "error", "-i", voicePath, "-filter:a", `atempo=${config.voiceSpeed}`, fast]);
        await rename(fast, voicePath);
      }
      audioDur = await probeDuration(voicePath);
      const total = audioDur + LEAD + TAIL + PAUSE;
      log(`  voice ${audioDur.toFixed(1)}s -> reel ${total.toFixed(1)}s`);
      const maxS = script.length === "long" ? config.maxLongSeconds : config.maxSeconds;
      if (total >= config.minSeconds && total <= maxS) break;
      // Slightly over: speed the read up (max 8%, inaudible) instead of paying for another rewrite.
      if (total > maxS && total <= maxS * 1.08) {
        const tempo = audioDur / (maxS - 0.4 - LEAD - TAIL - PAUSE);
        const fast = path.join(projectDir, "voice_fast.mp3");
        await run("ffmpeg", ["-y", "-v", "error", "-i", voicePath, "-filter:a", `atempo=${tempo.toFixed(4)}`, fast]);
        await rename(fast, voicePath);
        audioDur = await probeDuration(voicePath);
        log(`  voice sped up x${tempo.toFixed(3)} -> reel ${(audioDur + LEAD + TAIL + PAUSE).toFixed(1)}s`);
        break;
      }
      if (pass === 2) throw new StepError("tts", new Error(`reel length ${total.toFixed(1)}s outside ${config.minSeconds}-${maxS}s after rewrite`));
      const words = scriptPlain(script).split(/\s+/).length;
      const targetSec = total > maxS ? maxS - 6 : (config.minSeconds + config.maxSeconds) / 2;
      const targetWords = Math.round(words * (targetSec - LEAD - TAIL - PAUSE) / audioDur);
      ({ script } = await step("script", () => scriptWithChecks(blog, angle, costs, { targetWords, research, previous: script,
        feedback: `The voice-over came out at ${total.toFixed(0)} seconds; it must be ${config.minSeconds}-${maxS} seconds. ${total > maxS ? "Shorten" : "Lengthen"} the script to about ${targetWords} spoken words by ${total > maxS ? "cutting or merging the least important beats" : "adding one story beat"}; keep the hook, twist, takeaway and CTA.` }), { retries: 0 }));
    }

    const stt = await step("timing", () => transcribe(voicePath));
    costs.add("stt", stt.cost);
    // Captions in Roman Hinglish (brand font is Latin-only; Roman is what Indian Shorts use).
    const roman = await step("captions", () => romanize(stt.words.map((w) => w.text)));
    costs.add("captions_llm", roman.cost);
    const capWords = roman.words ? stt.words.map((w, i) => ({ ...w, cap: roman.words[i] })) : stt.words;
    const timeline = buildTimeline(script, capWords, { audioDuration: audioDur, lead: LEAD, tail: TAIL, pause: PAUSE });

    // AI B-roll first (best fit to the script); any shot it can't fill falls back to stock below.
    let ai = { made: 0, failed: 0, cast: {} };
    if (config.aiVideoModel) {
      try {
        ai = await step("ai_video", () => aiBroll(script, timeline.shots, projectDir), { retries: 0 });
        costs.add("ai_video", ai.cost);
        log(`  ai b-roll: ${ai.made} made, ${ai.failed} fell back to stock`);
      } catch (e) {
        log(`  ai b-roll skipped: ${e.message}`);
      }
    }
    const { credits, cost: visualCost } = await step("assets", () => resolveVisuals(timeline.shots, projectDir));
    costs.add("visual_check_llm", visualCost);

    const bed = angleKey === "B" ? "bed_b" : "bed_a";
    // Saved so visuals can be re-composed and re-rendered without new API calls (tools/recompose.mjs).
    const hookText = script.hook_text || "";
    await writeFile(path.join(projectDir, "timeline.json"), JSON.stringify({ timeline, title: script.title, bed, hookText }));
    await step("compose", () => writeProject(projectDir, { timeline, title: script.title, bed, hookText }), { retries: 0 });

    const mp4 = path.join(dir, `${jobId}.mp4`);
    const renderSeconds = await step("render", () => render(projectDir, mp4));
    const { duration } = await step("verify", () => verify(mp4, script.length === "long" ? config.maxLongSeconds : config.maxSeconds), { retries: 0 });

    let videoUrl = null;
    if (upload) videoUrl = await step("upload", () => uploadVideo(mp4, `${date}/${jobId.slice(11)}.mp4`));

    const hashtags = (script.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`));
    const result = {
      ok: true,
      job_id: jobId,
      blog_url: blogUrl,
      blog_title: blog.title,
      angle: angleKey,
      language: lang,
      title: script.title,
      hook_text: script.hook_text || null,
      hook_options: script.hook_options || [],
      script: scriptPlain(script),
      tts_input: scriptText(script),
      beats: script.beats.map((b) => ({ role: b.role, text: b.text, visual: b.visual })),
      caption: `${script.caption}\n\n${hashtags.join(" ")}`,
      // Posted as the first/pinned comment, never in the caption.
      first_comment: `Read the full guide: ${blog.url}`,
      hashtags,
      video_url: videoUrl,
      local_file: mp4,
      duration_s: Number(duration.toFixed(2)),
      length: script.length === "long" ? "long" : "short",
      length_reason: script.length_reason || null,
      hook_end_s: Number(timeline.hookEnd.toFixed(2)),
      hook_first_sentence_s: Number((LEAD + stt.words[Math.min(stt.words.length, stripTags(script.beats[0].text).split(/[.?!।]/)[0].trim().split(/\s+/).length) - 1].end).toFixed(2)),
      render_seconds: Math.round(renderSeconds),
      total_seconds: Math.round((Date.now() - t0) / 1000),
      cost_usd: costs.toJSON(),
      media_credits: credits,
      ai_broll: { model: config.aiVideoModel || null, made: ai.made, fell_back: ai.failed, cast: ai.cast },
      keyword: research.keyword,
      research_sources: [...new Set(research.notes.map((n) => n.source_url))],
      blog_conflicts: research.conflicts,
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
