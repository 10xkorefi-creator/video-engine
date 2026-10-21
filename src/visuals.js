import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { config } from "./config.js";
import { http, log, run } from "./util.js";
import { chatJSON } from "./openrouter.js";

const API = "https://pixabay.com/api";
const keyParam = () => (config.pixabayKey ? `key=${config.pixabayKey}&` : "");

async function download(url, dest) {
  if (existsSync(dest)) return dest;
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await http(url, {}, 300_000);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
  return dest;
}

/** Pick the best video rendition for a vertical crop: portrait > 4K > 1440p > 1080p, size-capped. */
function pickRendition(hit, minSeconds) {
  if (hit.duration < Math.min(minSeconds, 6)) return null;
  const r = Object.values(hit.videos).filter((v) => v.url && v.width && v.size < 90e6);
  const score = (v) => (v.height > v.width ? 5000 + v.height : v.height);
  r.sort((a, b) => score(b) - score(a));
  const best = r[0];
  if (!best) return null;
  // Landscape crop to 9:16 needs >=1440 source height to stay reasonably sharp.
  if (best.height < best.width && best.height < 1080) return null;
  return best;
}

async function searchVideos(query) {
  // Business category first (avoids e.g. "bill" -> pelican), then any category.
  for (const cat of ["&category=business", ""]) {
    const url = `${API}/videos/?${keyParam()}q=${encodeURIComponent(query)}&video_type=film&safesearch=true&per_page=30&order=popular${cat}`;
    const hits = (await (await http(url)).json()).hits || [];
    if (hits.length >= 3) return hits;
  }
  return [];
}

async function searchPhotos(query) {
  const url = `${API}/?${keyParam()}q=${encodeURIComponent(query)}&image_type=photo&orientation=vertical&safesearch=true&per_page=30&min_height=1600`;
  return (await (await http(url)).json()).hits || [];
}

/** Trim + crop + scale a clip to an exact 1080x1920 30fps silent segment. */
async function prepClip(src, dest, seconds) {
  if (existsSync(dest)) return dest;
  const tmp = dest.replace(/\.mp4$/, ".part.mp4");
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", "0.3", "-i", src, "-t", seconds.toFixed(2),
    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,fps=30,setsar=1,eq=saturation=1.08:contrast=1.04",
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", tmp,
  ]);
  await rename(tmp, dest);
  return dest;
}

// Stock "film" results still include doodles and cartoons; those never match a real-world line.
const BAD_TAGS = /\b(cartoon|doodle|animation|animated|illustration|drawing|sketch|clipart|vector|3d|render|motion graphics|infographic|whiteboard)\b/i;

/**
 * Vision check: show the candidates' thumbnails next to the spoken line and score each 0-10.
 * Returns { scores, better } where better is a fresh 2-3 word search if nothing fits.
 */
async function judge(line, query, cands) {
  const { json, cost } = await chatJSON({
    model: config.checkModel, temperature: 0, maxTokens: 1500,
    system: `You pick B-roll for a vertical explainer reel for Indian small-business founders. You get the line the narrator says while the clip plays, and numbered thumbnails.
Score each image 0-10 for how clearly it shows what the line is about, literally, so a viewer immediately connects picture and words. 8-10: shows the exact subject (e.g. an invoice for "invoice", a worried owner for "worried", a shop for "shopkeeper"). 5-7: same setting and mood. 0-4: unrelated object or scene, cartoon/drawing/animation, abstract, mostly text, a watermark, or a mismatched culture or setting.
Return ONLY JSON: {"scores":[one integer per image, in order],"better":"if every score is below 6, a 2-3 word ENGLISH stock-video search that would find a fitting real-world clip, else empty"}`,
    user: `Narrator line: "${line}"\nSearch used: "${query}"\nImages 1-${cands.length} follow.`,
    images: cands.map((c) => c.thumb),
  });
  return { scores: Array.isArray(json.scores) ? json.scores.map(Number) : [], better: String(json.better || "").trim(), cost };
}

/** Up to 5 usable video candidates and 3 photo candidates for one search. */
async function candidates(query, need, used, cache) {
  if (!cache.has(query)) {
    const [v, p] = await Promise.all([searchVideos(query).catch(() => []), searchPhotos(query).catch(() => [])]);
    cache.set(query, { v, p });
  }
  const { v, p } = cache.get(query);
  const vids = v.filter((h) => !used.has(`v${h.id}`) && !BAD_TAGS.test(h.tags || "") && pickRendition(h, need))
    .slice(0, 5).map((h) => ({ kind: "video", hit: h, thumb: h.videos?.small?.thumbnail || h.videos?.tiny?.thumbnail }));
  const pics = p.filter((h) => !used.has(`p${h.id}`) && !BAD_TAGS.test(h.tags || "")).slice(0, 3)
    .map((h) => ({ kind: "image", hit: h, thumb: h.webformatURL }));
  return [...vids, ...pics].filter((c) => c.thumb);
}

/**
 * Resolve every footage shot to a relevant local asset: the best-scoring video or photo for the
 * spoken line (vision-checked), else a text card. Returns shots with `asset: {kind, file}`.
 */
export async function resolveVisuals(shots, projectDir) {
  const used = new Set();
  const cache = new Map();
  const mediaDir = path.join(projectDir, "media");
  await mkdir(mediaDir, { recursive: true });
  const credits = [];
  let cost = 0;

  for (const [i, shot] of shots.entries()) {
    if (shot.visual?.type !== "footage") continue;
    const line = String(shot.beatText || "").replace(/\[[^\]]*\]\s*/g, "");
    const need = shot.end - shot.start + 0.6;
    let query = shot.visual.query || "business office";
    let pick = null;

    for (let round = 0; round < 2 && !pick; round++) {
      const cands = await candidates(query, need, used, cache);
      if (!cands.length) { query = query.split(" ").slice(-1)[0] + " business"; continue; }
      const asked = query;
      try {
        const j = await judge(line, query, cands);
        cost += j.cost;
        const best = j.scores.reduce((bi, sc, k) => (sc > (j.scores[bi] ?? -1) || (sc === j.scores[bi] && cands[k].kind === "video" && cands[bi].kind !== "video") ? k : bi), 0);
        if ((j.scores[best] ?? 0) >= 6) pick = cands[best];
        else if (j.better) query = j.better;
        log(`  shot${i} "${asked}": scores ${j.scores.join(",")}${pick ? ` -> ${pick.kind} ${pick.hit.id}` : ""}`);
      } catch (e) {
        log(`  visual check failed (${e.message}); using top result`);
        pick = cands[0];
      }
    }

    if (pick?.kind === "video") {
      used.add(`v${pick.hit.id}`);
      const rend = pickRendition(pick.hit, need);
      try {
        const raw = await download(rend.url, path.join(config.cacheDir, "pixabay", `v${pick.hit.id}_${rend.width}.mp4`));
        await prepClip(raw, path.join(mediaDir, `shot${i}.mp4`), need);
        shot.asset = { kind: "video", file: `media/shot${i}.mp4` };
        credits.push(`Pixabay video ${pick.hit.id} by ${pick.hit.user}`);
        continue;
      } catch (e) {
        log(`  clip ${pick.hit.id} failed: ${e.message}`);
      }
    }
    if (pick?.kind === "image") {
      used.add(`p${pick.hit.id}`);
      const ext = path.extname(new URL(pick.hit.largeImageURL).pathname) || ".jpg";
      const raw = await download(pick.hit.largeImageURL, path.join(config.cacheDir, "pixabay", `p${pick.hit.id}${ext}`));
      await run("cp", [raw, path.join(mediaDir, `shot${i}${ext}`)]);
      shot.asset = { kind: "image", file: `media/shot${i}${ext}` };
      credits.push(`Pixabay photo ${pick.hit.id} by ${pick.hit.user}`);
      continue;
    }
    log(`  no relevant media for "${line.slice(0, 60)}", using text card`);
    shot.asset = { kind: "none" };
  }
  return { shots, credits, cost };
}

export async function fileSize(f) { return (await stat(f)).size; }
