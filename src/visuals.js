import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { config } from "./config.js";
import { http, log, run } from "./util.js";

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

/**
 * Resolve every footage shot to a local asset (video, else photo, else a text-card fallback).
 * Returns shots with `asset: {kind, file, credit}`; files are copied into projectDir/media.
 */
export async function resolveVisuals(shots, projectDir) {
  const used = new Set();
  const searches = new Map();
  const mediaDir = path.join(projectDir, "media");
  await mkdir(mediaDir, { recursive: true });
  const credits = [];

  for (const [i, shot] of shots.entries()) {
    if (shot.visual?.type !== "footage") continue;
    const q = shot.visual.query || "business office";
    const need = shot.end - shot.start + 0.6;
    const queries = [q, q.split(" ").slice(-1)[0] + " business", "office work"];
    let done = false;

    for (const query of queries) {
      if (!searches.has(query)) searches.set(query, await searchVideos(query).catch(() => []));
      for (const hit of searches.get(query)) {
        if (used.has(`v${hit.id}`)) continue;
        const rend = pickRendition(hit, need);
        if (!rend) continue;
        used.add(`v${hit.id}`);
        try {
          const raw = await download(rend.url, path.join(config.cacheDir, "pixabay", `v${hit.id}_${rend.width}.mp4`));
          const file = await prepClip(raw, path.join(mediaDir, `shot${i}.mp4`), need);
          shot.asset = { kind: "video", file: `media/shot${i}.mp4` };
          credits.push(`Pixabay video ${hit.id} by ${hit.user}`);
          done = true;
        } catch (e) {
          log(`  clip ${hit.id} failed: ${e.message}`);
        }
        break;
      }
      if (done) break;
    }

    if (!done) {
      // Photo fallback (Ken Burns still).
      for (const query of queries) {
        const hits = await searchPhotos(query).catch(() => []);
        const hit = hits.find((h) => !used.has(`p${h.id}`));
        if (!hit) continue;
        used.add(`p${hit.id}`);
        const ext = path.extname(new URL(hit.largeImageURL).pathname) || ".jpg";
        const raw = await download(hit.largeImageURL, path.join(config.cacheDir, "pixabay", `p${hit.id}${ext}`));
        const dest = path.join(mediaDir, `shot${i}${ext}`);
        await run("cp", [raw, dest]);
        shot.asset = { kind: "image", file: `media/shot${i}${ext}` };
        credits.push(`Pixabay photo ${hit.id} by ${hit.user}`);
        done = true;
        break;
      }
    }
    if (!done) {
      log(`  no media for "${q}", using text card`);
      shot.asset = { kind: "none" };
    }
  }
  return { shots, credits };
}

export async function fileSize(f) { return (await stat(f)).size; }
