// Picks which top blog the next reel is made from.
// Blogs are ranked by search performance (clicks and impressions count equally, by rank so one
// huge-impression post cannot drown the rest). A blog gets its first reel before any blog gets a
// second; once all have one, the best blogs get another reel from a new angle.
import { topBlogs, usedJobs } from "./storage.js";

const ANGLE_ORDER = ["A", "D", "B", "C"]; // founder story first; it fits most posts

export function rankBlogs(rows) {
  const rankBy = (key) => {
    const sorted = [...rows].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    return new Map(sorted.map((r, i) => [r.id, i]));
  };
  const byClicks = rankBy("clicks"), byImpr = rankBy("impressions");
  return [...rows]
    .map((r) => ({ ...r, score: byClicks.get(r.id) + byImpr.get(r.id) }))
    .sort((a, b) => a.score - b.score || (b.clicks || 0) - (a.clicks || 0));
}

/** Next `count` jobs: [{ blog_id, blog_url, title, angle, clicks, impressions, reels_so_far }]. */
export async function nextBlogJobs(count = 1) {
  const [rows, used] = await Promise.all([topBlogs(), usedJobs()]);
  const ranked = rankBlogs(rows.filter((r) => r.url && r.body));
  const anglesUsed = new Map();
  for (const u of used) {
    const key = String(u.blog_url || "").replace(/\/$/, "");
    if (!anglesUsed.has(key)) anglesUsed.set(key, new Set());
    anglesUsed.get(key).add(String(u.angle || "").toUpperCase());
  }
  const jobs = [];
  // Round 0: blogs with no reel yet; round 1: second reel, etc. Best-ranked first in each round.
  for (let round = 0; round < ANGLE_ORDER.length && jobs.length < count; round++) {
    for (const b of ranked) {
      if (jobs.length >= count) break;
      const done = anglesUsed.get(b.url.replace(/\/$/, "")) || new Set();
      if (done.size !== round) continue;
      const angle = ANGLE_ORDER.find((a) => !done.has(a));
      if (!angle) continue;
      jobs.push({ blog_id: b.id, blog_url: b.url, title: b.title, angle, clicks: b.clicks, impressions: b.impressions, reels_so_far: done.size });
      done.add(angle);
      anglesUsed.set(b.url.replace(/\/$/, ""), done);
    }
  }
  return { jobs, blogs: ranked.length };
}
