// Per-reel score: a custom instrumental (Lyria) built around this reel's timing, checked for vocals,
// then pre-mixed with ffmpeg: levelled, ducked under the voice, dropped out before the twist, faded out.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "./config.js";
import { generateMusic, transcribe } from "./openrouter.js";
import { log, run } from "./util.js";

const STYLES = [
  "punchy lo-fi hip-hop: crisp swung hi-hats, tight kick, warm Rhodes chords, subtle tabla fills",
  "modern Indian trap: deep 808 bass, snappy claps, rolling hi-hats, a short sitar-like pluck motif",
  "upbeat funky groove: tight live drums, slap bass, bright muted guitar stabs, playful",
  "driving cinematic electronic pulse: ticking hi-hats, big synth bass, short risers, confident",
];

function prompt(tl, seed) {
  const style = STYLES[seed % STYLES.length];
  const total = Math.ceil(tl.total + 2);
  const twist = tl.twistAt ? tl.twistAt.toFixed(1) : null;
  return [
    `Instrumental background score for a fast-paced Instagram/YouTube Shorts explainer about money and business for Indian founders. Style: ${style}. Around 105 BPM.`,
    "Starts IMMEDIATELY with the full beat on the very first second (no fade-in, no slow intro) to hook the viewer.",
    twist ? `Energy builds steadily; at about ${(tl.twistAt - 1.5).toFixed(1)} seconds strip down to a tense, minimal groove, then at ${twist} seconds drop back in harder with extra drums and bass and keep that higher energy to the end.` : "Energy builds steadily throughout with small fills every 8 bars.",
    `Total length about ${total} seconds, ending on a clean final hit.`,
    "Strictly instrumental: no vocals, no singing, no choir, no spoken words. Mix with space for a voice-over: no busy lead melody in the mid-range.",
  ].join(" ");
}

/** Generate (or reuse) the raw track; reject tracks with vocals once. */
async function rawTrack(tl, seed) {
  const p = prompt(tl, seed);
  const dir = path.join(config.cacheDir, "music");
  await mkdir(dir, { recursive: true });
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const file = path.join(dir, createHash("sha1").update(`${p}|${attempt}`).digest("hex").slice(0, 16) + ".mp3");
    if (!existsSync(file)) {
      const m = await generateMusic(p, { model: config.musicModel });
      cost += m.cost;
      await writeFile(file, m.audio);
    }
    // vocal check: a transcript with real words means the model sang/spoke
    const words = await transcribe(file).then((r) => r.words.filter((w) => !/^\[.*\]$/.test(w.text.trim()))).catch(() => []);
    cost += 0.003;
    if (words.length <= 3) return { file, cost, prompt: p };
    log(`  music attempt ${attempt + 1} had vocals (${words.length} words), regenerating`);
  }
  throw new Error("music kept coming back with vocals");
}

/** Seconds into the track where it first reaches full energy (Lyria often opens with a soft intro). */
async function energeticStart(file) {
  const mean = async (ss, t) => {
    const out = await run("ffmpeg", ["-hide_banner", "-ss", String(ss), "-t", String(t), "-i", file, "-af", "volumedetect", "-f", "null", "-"], { stderr: true }).catch((e) => e.message);
    const m = String(out).match(/mean_volume: (-?[\d.]+)/);
    return m ? Number(m[1]) : -99;
  };
  const whole = await mean(0, 60);
  for (let s = 0; s <= 10; s += 0.5) if ((await mean(s, 0.5)) >= whole - 3) return s;
  return 0;
}

/** Level the score under the voice, duck it while speech plays, drop it before the twist, fade the end. */
export async function mixTrack(file, tl, voiceFile, out) {
  const start = await energeticStart(file);
    // voice bus aligned to the timeline (the voice is split into clips around the twist pause)
    const segs = tl.voice.map((v, i) => `[1:a]atrim=start=${v.mediaStart.toFixed(3)}:duration=${v.duration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(v.start * 1000)}:all=1[v${i}]`);
    const vmix = tl.voice.length > 1 ? `${tl.voice.map((_, i) => `[v${i}]`).join("")}amix=inputs=${tl.voice.length}:normalize=0[vb]` : `[v0]anull[vb]`;
    const drop = tl.twistAt ? `,volume='if(between(t,${(tl.twistAt - 1.45).toFixed(2)},${(tl.twistAt - 0.02).toFixed(2)}),0.18,1)':eval=frame` : "";
    const filter = [
      ...segs, vmix,
      `[vb]asplit=2[sc][vout]`,
      // level the score well below the voice, then duck it further whenever someone speaks
      `[0:a]atrim=${start}:${(start + tl.total).toFixed(2)},asetpts=PTS-STARTPTS,loudnorm=I=-21:TP=-2:LRA=9${drop}[m]`,
      `[m][sc]sidechaincompress=threshold=0.05:ratio=3.5:attack=20:release=300:makeup=1[duck]`,
      `[duck]afade=t=out:st=${Math.max(0, tl.total - 1.3).toFixed(2)}:d=1.3,volume=1.0[out]`,
      `[vout]anullsink`,
    ].join(";");
    await run("ffmpeg", ["-y", "-v", "error", "-stream_loop", "-1", "-i", file, "-i", voiceFile, "-filter_complex", filter, "-map", "[out]", "-ac", "2", "-ar", "44100", "-b:a", "192k", "-t", tl.total.toFixed(2), out]);
}

/**
 * Returns { src, mixed, cost } for compose.js. On any failure the built-in bed is used (mixed:false).
 */
export async function scoreReel(tl, projectDir, { bed = "bed_a", seed = Math.round(tl.total * 1000) % 997, voiceFile } = {}) {
  if (!config.musicModel) return { src: `assets/audio/${bed}.mp3`, mixed: false, cost: 0 };
  try {
    const { file, cost, prompt: p } = await rawTrack(tl, seed);
    await mixTrack(file, tl, voiceFile, path.join(projectDir, "music_mix.mp3"));
    log(`  music: custom score mixed (${p.slice(0, 80)}...)`);
    return { src: "music_mix.mp3", mixed: true, cost };
  } catch (e) {
    log(`  music fell back to built-in bed: ${e.message}`);
    return { src: `assets/audio/${bed}.mp3`, mixed: false, cost: 0 };
  }
}
