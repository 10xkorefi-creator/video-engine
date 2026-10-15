import { spawn } from "node:child_process";

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export class StepError extends Error {
  constructor(step, cause) {
    super(`${step}: ${cause?.message || cause}`);
    this.step = step;
    this.cause = cause;
  }
}

/** Run one pipeline step; retry once on failure, then throw a StepError naming the step. */
export async function step(name, fn, { retries = 1 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = Date.now();
    try {
      log(`▶ ${name}${attempt ? ` (retry ${attempt})` : ""}`);
      const r = await fn(attempt);
      log(`✔ ${name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return r;
    } catch (e) {
      if (e instanceof StepError) throw e; // already names the failing sub-step
      last = e;
      log(`✖ ${name}: ${e.message}`);
    }
  }
  throw new StepError(name, last);
}

/** fetch with timeout and a readable error on non-2xx. */
export async function http(url, opts = {}, timeoutMs = 120_000) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${url.split("?")[0]}: ${body.slice(0, 300)}`);
  }
  return res;
}

export function run(cmd, args, { cwd, env, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => { out += d; if (!quiet) process.stdout.write(d); });
    p.stderr.on("data", (d) => { err += d; if (!quiet) process.stderr.write(d); });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${(err || out).slice(-800)}`)));
  });
}

export async function probeDuration(file) {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(out.trim());
}

export const slugify = (s) =>
  s.toLowerCase().replace(/https?:\/\/[^/]+\/(blog\/)?/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Tracks spend per step (USD). */
export class Costs {
  items = {};
  add(k, usd) { this.items[k] = (this.items[k] || 0) + (Number(usd) || 0); }
  get total() { return Object.values(this.items).reduce((a, b) => a + b, 0); }
  toJSON() {
    const r = {};
    for (const [k, v] of Object.entries(this.items)) r[k] = Number(v.toFixed(5));
    return { ...r, total: Number(this.total.toFixed(5)) };
  }
}
