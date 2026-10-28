// AI-generated B-roll: every footage shot gets its own clip written from the narrator's line, with one
// consistent cast across the reel. Each clip is quality-checked on a real frame; a weak clip is
// regenerated once, and a shot that still fails falls back to vision-checked stock (visuals.js).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { config, ROOT } from "./config.js";
import { chatJSON, generateVideo } from "./openrouter.js";
import { judge, prepClip } from "./visuals.js";
import { log, run } from "./util.js";

const stripTags = (s) => String(s || "").replace(/\[[^\]]*\]\s*/g, "").trim();

/** One director pass: a cast bible + one cinematic prompt per footage shot, in story order. */
async function direct(script, shots) {
  const castFile = path.join(ROOT, "config", "cast.json");
  const brandCast = existsSync(castFile) ? JSON.parse(await readFile(castFile, "utf8")) : {};
  delete brandCast._note;
  const list = shots.map((m) => ({ id: m.id, role: m.role, line: m.line, seconds: m.clipLen, cuts: m.shots.length, stock_hint: m.query }));
  const { json, cost } = await chatJSON({
    model: config.scriptModel, temperature: 0.7, maxTokens: 6000,
    system: `You are the director of photography for a vertical (9:16) explainer reel for Indian small-business founders. The narrator's script is fixed. For each B-roll shot you write ONE prompt for a text-to-video model (Google Veo). The clip plays while the narrator says that shot's line, so it must show what the line is about, literally and instantly readable on a phone.

RULES
- BRAND CAST (recurring characters across our reels; use these EXACT looks): ${JSON.stringify(brandCast)}. If the script names one of them, use that look. If the protagonist is an unnamed founder/owner, cast Rohan; an unnamed accountant is Sharma ji; an unnamed young CA/accounts person is Priya.
- First define a CAST: the story's protagonist (and at most one other recurring person, e.g. a supplier or accountant), each with a fixed, specific look: age, build, hair, facial hair, exact clothing and colours, setting. Copy that exact description into every prompt where the person appears, so they look the same in every shot.
- Authentic, contemporary India: Indian people, real Indian small-business settings (wholesale market, trading office, shop counter, small factory floor, warehouse, home office), natural light, documentary realism. No Western offices, no stock-photo smiles.
- Cinematography: vertical framing, subject large in frame, one clear action per shot, a specific camera move (slow push-in, handheld follow, gentle dolly, rack focus), shallow depth of field. Vary shot sizes across the reel (wide, medium, close-up, extreme close-up of hands/objects) so cuts feel energetic.
- Each item is ONE continuous clip that the editor cuts into "cuts" pieces (with punch-in crops). So when cuts > 1, design an action that clearly evolves across the clip (e.g. starts on the hands, then the person looks up in shock; or a push-in from medium to close-up), so every piece shows something new.
- The hook shot (role hook) must be the most striking image: tension, surprise or a dramatic close-up.
- Emotion follows the story: worry when the problem lands, relief at the solution.
- NEVER show readable text: no documents in close-up with legible writing, no phone/laptop screens facing camera, no signs, no logos, no captions, no numbers. Paper and screens may appear only out of focus or at an angle.
- No money counting close-ups, no politicians, no government buildings, no brand names.
- Each prompt 45-80 words, present tense, starting with the shot size and camera move. End every prompt with: "Photorealistic, natural colours, no text, no captions, no logos, no watermark."

Return ONLY JSON: {"cast":{"<name>":"<fixed look>"},"shots":[{"id":<clip id>,"prompt":"..."}]}`,
    user: `REEL TITLE: ${script.title}\nFULL SCRIPT: ${script.beats.map((b) => stripTags(b.text)).join(" ")}\n\nB-ROLL CLIPS (in order):\n${JSON.stringify(list, null, 1)}`,
  });
  const byId = new Map((json.shots || []).map((s) => [Number(s.id), String(s.prompt || "")]));
  return { prompts: byId, cast: json.cast || {}, cost };
}

/** Middle frame of a clip as a data URL (for the vision check). */
async function frameDataUrl(file, at) {
  const png = file.replace(/\.mp4$/, `_qa.jpg`);
  await run("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=432:-1", "-q:v", "4", png]);
  return `data:image/jpeg;base64,${(await readFile(png)).toString("base64")}`;
}

/** QA one generated clip: relevance to the line + no garbled text/limbs. Returns a 0-10 score. */
async function qa(file, line, prompt) {
  const imgs = await Promise.all([frameDataUrl(file, 0.8), frameDataUrl(file, 2.6)]);
  const j = await judge(`${line}  [QUALITY: also give 0-3 if the frame shows garbled or readable text, deformed hands or faces, or looks fake/cartoonish]`, prompt.slice(0, 120), imgs.map((thumb) => ({ thumb })));
  return { score: Math.min(...j.scores.filter((n) => Number.isFinite(n)), 10), cost: j.cost };
}

async function cachedClip(prompt, dir, duration) {
  const key = createHash("sha1").update(`${config.aiVideoModel}|${config.aiVideoResolution}|${duration}|${prompt}`).digest("hex").slice(0, 16);
  const file = path.join(dir, `${key}.mp4`);
  if (existsSync(file)) return { file, cost: 0 };
  const { video, cost } = await generateVideo({ model: config.aiVideoModel, prompt, duration, resolution: config.aiVideoResolution });
  await mkdir(dir, { recursive: true });
  await writeFile(file, video);
  return { file, cost };
}

const CAST_WORDS = /\b(rohan|sharma|priya|founder|owner|accountant|vendor|supplier|ca|team|he|she|his|her)\b/i;

/**
 * Fill footage beats with AI clips under a hard budget (config.aiVideoBudget).
 * One clip per beat ("moment"): the beat's fast cuts are different stretches and punch-in crops of
 * that clip, and a clip may play in slight slow motion (>=0.8x) to cover a longer line. The hook and
 * people/character beats are bought first; beats beyond the budget, or that fail QA, keep no asset
 * so the stock resolver fills them. Returns { cost, made, failed, cast }.
 */
export async function aiBroll(script, shots, projectDir) {
  const foot = shots.map((s, idx) => ({ ...s, idx })).filter((s) => s.visual?.type === "footage");
  if (!foot.length) return { cost: 0, made: 0, failed: 0, cast: {} };

  const byBeat = new Map();
  for (const s of foot) (byBeat.get(s.beat) || byBeat.set(s.beat, []).get(s.beat)).push(s);
  const price = config.aiVideoPricePerSec;
  const moments = [...byBeat.entries()].map(([beat, list]) => {
    const start = list[0].start, end = list[list.length - 1].end;
    const need = end - start + 0.3; // seconds of picture incl. transition overlap
    const clipLen = [4, 6, 8].find((L) => L - 0.05 >= need * 0.8) || 8;
    const line = stripTags(list[0].beatText);
    const prio = list[0].role === "hook" ? 0 : CAST_WORDS.test(line) ? 1 : 2;
    return { id: beat, beat, shots: list, start, end, need, clipLen, line, role: list[0].role, query: list[0].visual?.query || "", prio, est: clipLen * price };
  });

  // Buy in priority order (story order within a priority) with ~15% of the budget kept for retries.
  let reserved = 0;
  const chosen = [];
  for (const m of [...moments].sort((a, b) => a.prio - b.prio || a.beat - b.beat)) {
    if (reserved + m.est <= config.aiVideoBudget * 0.85) { chosen.push(m); reserved += m.est; }
  }
  if (!chosen.length) return { cost: 0, made: 0, failed: foot.length, cast: {} };
  log(`  ai b-roll plan: ${chosen.length}/${moments.length} beats, ~$${reserved.toFixed(2)} of $${config.aiVideoBudget} budget`);

  const d = await direct(script, chosen.sort((a, b) => a.beat - b.beat));
  let cost = d.cost;
  const raw = path.join(config.cacheDir, "ai-video");
  const mediaDir = path.join(projectDir, "media");
  await mkdir(mediaDir, { recursive: true });

  const results = await Promise.all(chosen.map(async (m) => {
    let prompt = d.prompts.get(m.id);
    if (!prompt) return 0;
    let best = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      // A retry is a new purchase: only if it still fits the budget.
      if (attempt > 0) { if (reserved + m.est > config.aiVideoBudget) break; reserved += m.est; }
      try {
        const clip = await cachedClip(prompt, raw, m.clipLen);
        cost += clip.cost;
        const q = await qa(clip.file, m.line, prompt);
        cost += q.cost;
        log(`  ai beat${m.beat} try${attempt + 1}: QA ${q.score}/10`);
        if (!best || q.score > best.score) best = { ...clip, score: q.score, prompt };
        if (q.score >= 5) break;
        prompt = `${prompt.replace(/ Photorealistic, natural colours.*$/, "")} Keep any paper or screen blurred and out of focus; show the person's face and action clearly. Photorealistic, natural colours, no text, no captions, no logos, no watermark.`;
      } catch (e) {
        log(`  ai beat${m.beat} failed: ${e.message}`);
      }
    }
    if (!best || best.score < 4) return 0;
    const usable = m.clipLen - 0.05;
    const speed = Math.max(0.8, Math.min(1, usable / m.need));
    const lead = Math.max(0, Math.min(0.3, usable - m.need * speed));
    await Promise.all(m.shots.map(async (s, k) => {
      const out = s.end - s.start + 0.3;
      const offset = Math.min(lead + (s.start - m.start) * speed, Math.max(0, usable - out * speed));
      await prepClip(best.file, path.join(mediaDir, `shot${s.idx}.mp4`), out, offset, { speed, zoom: k % 2 ? 1.28 : 1 });
      shots[s.idx].asset = { kind: "video", file: `media/shot${s.idx}.mp4` };
      shots[s.idx].aiPrompt = best.prompt;
    }));
    return m.shots.length;
  }));
  const made = results.reduce((a, b) => a + b, 0);
  return { cost, made, failed: foot.length - made, cast: d.cast };
}
