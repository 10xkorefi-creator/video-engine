import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { config } from "./config.js";
import { http, log, run } from "./util.js";
import { chatJSON } from "./openrouter.js";

const PIXABAY = "https://pixabay.com/api";
const keyParam = () => (config.pixabayKey ? `key=${config.pixabayKey}&` : "");
const REUSE_DAYS = 21; // a clip or photo is not reused in another reel for this long

async function download(url, dest) {
  if (existsSync(dest)) return dest;
  await mkdir(path.dirname(dest), { recursive: true });
  const res = await http(url, {}, 300_000);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
  return dest;
}

// ---------- providers: every candidate has the same shape ----------
// { id, kind: "video"|"image", thumb, url, width, height, duration, tags, credit }

/** Best Pixabay rendition for a vertical crop: portrait > 4K > 1440p > 1080p, size-capped. */
function pixabayRendition(hit, minSeconds) {
  if (hit.duration < Math.min(minSeconds, 6)) return null;
  const r = Object.values(hit.videos).filter((v) => v.url && v.width && v.size < 90e6);
  r.sort((a, b) => (b.height > b.width ? 5000 + b.height : b.height) - (a.height > a.width ? 5000 + a.height : a.height));
  const best = r[0];
  if (!best || (best.height < best.width && best.height < 1080)) return null; // landscape crop needs height
  return best;
}

async function pixabay(query, need) {
  const get = async (u) => (await (await http(u)).json()).hits || [];
  const q = encodeURIComponent(query);
  // popular + latest, business category first (avoids "bill" -> pelican), so results rotate between reels
  const [pop, late, any, pics] = await Promise.all([
    get(`${PIXABAY}/videos/?${keyParam()}q=${q}&video_type=film&safesearch=true&per_page=50&order=popular&category=business`).catch(() => []),
    get(`${PIXABAY}/videos/?${keyParam()}q=${q}&video_type=film&safesearch=true&per_page=30&order=latest&category=business`).catch(() => []),
    get(`${PIXABAY}/videos/?${keyParam()}q=${q}&video_type=film&safesearch=true&per_page=30&order=popular`).catch(() => []),
    get(`${PIXABAY}/?${keyParam()}q=${q}&image_type=photo&orientation=vertical&safesearch=true&per_page=40&min_height=1600`).catch(() => []),
  ]);
  const seen = new Set();
  const vids = [...pop, ...late, ...any].filter((h) => !seen.has(h.id) && seen.add(h.id)).flatMap((h) => {
    const r = pixabayRendition(h, need);
    return r ? [{ id: `pxb-v${h.id}`, kind: "video", thumb: h.videos?.small?.thumbnail || h.videos?.tiny?.thumbnail, url: r.url, width: r.width, height: r.height,
      duration: h.duration, tags: h.tags || "", credit: `Pixabay video ${h.id} by ${h.user}` }] : [];
  });
  const imgs = pics.map((h) => ({ id: `pxb-p${h.id}`, kind: "image", thumb: h.webformatURL, url: h.largeImageURL, tags: h.tags || "", credit: `Pixabay photo ${h.id} by ${h.user}` }));
  return { vids, imgs };
}

/** Pexels (optional, PEXELS_API_KEY): strong on portrait clips and people. */
async function pexels(query, need) {
  if (!config.pexelsKey) return { vids: [], imgs: [] };
  const headers = { Authorization: config.pexelsKey };
  const q = encodeURIComponent(query);
  const [v, p] = await Promise.all([
    // /v1/videos is the current path; the older /videos path is kept as a fallback
    http(`https://api.pexels.com/v1/videos/search?query=${q}&orientation=portrait&per_page=30`, { headers }).then((r) => r.json())
      .catch(() => http(`https://api.pexels.com/videos/search?query=${q}&orientation=portrait&per_page=30`, { headers }).then((r) => r.json()))
      .catch(() => ({})),
    http(`https://api.pexels.com/v1/search?query=${q}&orientation=portrait&per_page=20`, { headers }).then((r) => r.json()).catch(() => ({})),
  ]);
  const vids = (v.videos || []).filter((x) => x.duration >= Math.min(need, 6)).flatMap((x) => {
    const f = (x.video_files || []).filter((f) => f.link && f.height >= 1280 && f.height > f.width).sort((a, b) => a.height - b.height)[0];
    return f ? [{ id: `pex-v${x.id}`, kind: "video", thumb: x.image, url: f.link, width: f.width, height: f.height, duration: x.duration, tags: "",
      credit: `Pexels video ${x.id} by ${x.user?.name || "Pexels"}` }] : [];
  });
  const imgs = (p.photos || []).map((x) => ({ id: `pex-p${x.id}`, kind: "image", thumb: x.src?.medium, url: x.src?.portrait || x.src?.large2x, tags: x.alt || "",
    credit: `Pexels photo ${x.id} by ${x.photographer}` }));
  return { vids, imgs };
}

// ---------- cross-reel memory: the same clip never shows up in back-to-back reels ----------
const historyFile = () => path.join(config.cacheDir, "used_assets.json");
async function loadHistory() {
  try { return JSON.parse(await readFile(historyFile(), "utf8")); } catch { return {}; }
}
async function saveHistory(h) {
  const cutoff = Date.now() - REUSE_DAYS * 864e5;
  for (const [k, t] of Object.entries(h)) if (t < cutoff) delete h[k];
  await mkdir(config.cacheDir, { recursive: true });
  await writeFile(historyFile(), JSON.stringify(h));
}

/** Trim + crop + scale a clip to an exact 1080x1920 30fps silent segment, from a varied start point. */
async function prepClip(src, dest, seconds, offset) {
  if (existsSync(dest)) return dest;
  const tmp = dest.replace(/\.mp4$/, ".part.mp4");
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", offset.toFixed(2), "-i", src, "-t", seconds.toFixed(2),
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

/** Different-but-repeatable order per reel, so the same search does not always surface the same clip. */
function rotate(list, seed) {
  const key = (i) => { const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); };
  return list.map((c, i) => ({ c, k: key(i) })).sort((a, b) => a.k - b.k).map((x) => x.c);
}

/** Up to 9 fresh candidates (6 videos + 3 photos) across providers for one search. */
async function candidates(query, need, used, cache, seed) {
  if (!cache.has(query)) {
    const none = { vids: [], imgs: [] };
    const [a, b] = await Promise.all([pixabay(query, need).catch(() => none), pexels(query, need).catch(() => none)]);
    cache.set(query, { vids: [...b.vids, ...a.vids], imgs: [...b.imgs, ...a.imgs] });
  }
  const { vids, imgs } = cache.get(query);
  const fresh = (c) => !used.has(c.id) && !BAD_TAGS.test(c.tags) && c.thumb;
  // the top results are the relevant ones, so rotate within the top slice only
  const v = rotate(vids.filter(fresh).slice(0, 18), seed).slice(0, 6);
  const p = rotate(imgs.filter(fresh).slice(0, 10), seed).slice(0, 3);
  return [...v, ...p];
}

/**
 * Resolve every footage shot to a relevant, not-recently-used asset: the best-scoring video or photo
 * for the spoken line (vision-checked), else a text card. Returns shots with `asset: {kind, file}`.
 */
export async function resolveVisuals(shots, projectDir, { seed = Date.now() % 997 } = {}) {
  const history = await loadHistory();
  const used = new Set(Object.keys(history));
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
      const cands = await candidates(query, need, used, cache, seed + i);
      if (!cands.length) { query = query.split(" ").slice(-1)[0] + " business"; continue; }
      const asked = query;
      try {
        const j = await judge(line, query, cands);
        cost += j.cost;
        const best = j.scores.reduce((bi, sc, k) => (sc > (j.scores[bi] ?? -1) || (sc === j.scores[bi] && cands[k].kind === "video" && cands[bi].kind !== "video") ? k : bi), 0);
        if ((j.scores[best] ?? 0) >= 5) pick = cands[best];
        else if (j.better) query = j.better;
        log(`  shot${i} "${asked}": scores ${j.scores.join(",")}${pick ? ` -> ${pick.id}` : ""}`);
      } catch (e) {
        log(`  visual check failed (${e.message}); using top result`);
        pick = cands[0];
      }
    }

    if (pick) {
      used.add(pick.id);
      history[pick.id] = Date.now();
      try {
        if (pick.kind === "video") {
          const raw = await download(pick.url, path.join(config.cacheDir, "stock", `${pick.id}_${pick.width}.mp4`));
          // start somewhere inside the clip, not always at the same frame
          const room = Math.max(0, (pick.duration || need) - need - 0.5);
          const offset = 0.3 + (room > 0 ? (((seed * 7 + i * 13) % 100) / 100) * room : 0);
          await prepClip(raw, path.join(mediaDir, `shot${i}.mp4`), need, offset);
          shot.asset = { kind: "video", file: `media/shot${i}.mp4` };
        } else {
          const ext = path.extname(new URL(pick.url).pathname) || ".jpg";
          const raw = await download(pick.url, path.join(config.cacheDir, "stock", `${pick.id}${ext}`));
          await run("cp", [raw, path.join(mediaDir, `shot${i}${ext}`)]);
          shot.asset = { kind: "image", file: `media/shot${i}${ext}` };
        }
        credits.push(pick.credit);
        continue;
      } catch (e) {
        log(`  ${pick.id} failed: ${e.message}`);
      }
    }
    log(`  no relevant media for "${line.slice(0, 60)}", using text card`);
    shot.asset = { kind: "none" };
  }
  await saveHistory(history).catch((e) => log(`  asset history not saved: ${e.message}`));
  return { shots, credits, cost };
}

export async function fileSize(f) { return (await stat(f)).size; }
