import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { http, log } from "./util.js";

function headers(extra = {}) {
  const h = { ...extra };
  // When no key is configured we rely on an egress proxy injecting it (cloud sandbox).
  if (config.supabaseKey) {
    h.apikey = config.supabaseKey;
    h.Authorization = `Bearer ${config.supabaseKey}`;
  }
  return h;
}

export async function uploadVideo(file, objectPath) {
  const url = `${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${objectPath}`;
  await http(url, {
    method: "POST",
    headers: headers({ "Content-Type": "video/mp4", "x-upsert": "true", "cache-control": "3600" }),
    body: await readFile(file),
  }, 300_000);
  return `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseBucket}/${objectPath}`;
}

/** Upsert the job row keyed on (blog_url, angle). Never throws: tracking must not kill a render. */
export async function saveJob(row) {
  try {
    const url = `${config.supabaseUrl}/rest/v1/${config.supabaseTable}?on_conflict=blog_url,angle,language`;
    await http(url, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
    }, 30_000);
  } catch (e) {
    log(`  (job row not saved: ${e.message})`);
  }
}

/** Source keys (blog URLs and topic:<id>) already used in reel_jobs. */
export async function usedSources() {
  const url = `${config.supabaseUrl}/rest/v1/${config.supabaseTable}?select=blog_url&status=neq.failed&limit=10000`; // failed topics (e.g. out of credits) get retried
  const rows = await (await http(url, { headers: headers() }, 30_000)).json();
  return new Set(rows.map((r) => r.blog_url));
}

/** (blog_url, angle) of every reel already made or in progress (failed ones get retried). */
export async function usedJobs() {
  const url = `${config.supabaseUrl}/rest/v1/${config.supabaseTable}?select=blog_url,angle&status=neq.failed&limit=10000`;
  return (await http(url, { headers: headers() }, 30_000)).json();
}

/** Rows of the top_blogs table (our best-performing blog posts, with full body). */
export async function topBlogs({ id } = {}) {
  const cols = "id,slug,url,title,description,keywords,body,clicks,impressions,ctr,avg_position,blog_category";
  const url = `${config.supabaseUrl}/rest/v1/${config.topBlogsTable}?select=${cols}${id != null ? `&id=eq.${encodeURIComponent(id)}` : ""}&limit=1000`;
  const rows = await (await http(url, { headers: headers() }, 30_000)).json();
  if (!Array.isArray(rows)) throw new Error(`top_blogs read failed: ${JSON.stringify(rows).slice(0, 200)}`);
  return rows;
}
