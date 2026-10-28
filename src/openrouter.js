import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { http } from "./util.js";

const BASE = "https://openrouter.ai/api/v1";

function headers(extra = {}) {
  const h = { "HTTP-Referer": "https://www.aiaccountant.com", "X-Title": "AIA reel engine", ...extra };
  if (config.openrouterKey) h.Authorization = `Bearer ${config.openrouterKey}`;
  return h;
}

/** Chat completion that returns parsed JSON + actual USD cost. */
export async function chatJSON({ model, system, user, maxTokens = 8000, temperature = 0.8, effort = "low", images = [] }) {
  const res = await http(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      reasoning: { effort },
      usage: { include: true },
      messages: [
        // Cache the long, constant system prompt: repeat drafts pay ~10% for it.
        { role: "system", content: system.length > 4000 ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : system },
        { role: "user", content: images.length ? [{ type: "text", text: user }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] : user },
      ],
    }),
  }, 180_000);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { throw new Error(`model returned invalid JSON (${e.message}; finish=${data.choices?.[0]?.finish_reason}): ...${content.slice(-300)}`); }
  return { json: parsed, cost: data.usage?.cost ?? 0, usage: data.usage };
}

async function generationCost(id) {
  if (!id) return null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${BASE}/generation?id=${id}`, { headers: headers() });
      if (r.ok) {
        const d = (await r.json()).data;
        if (d?.total_cost != null) return d.total_cost;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

/** Text to speech -> mp3 buffer + cost. */
export async function speak(text, { model = config.ttsModel, voice = config.ttsVoice } = {}) {
  const res = await http(`${BASE}/audio/speech`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model, input: text, voice, response_format: "mp3" }),
  }, 180_000);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 5000) throw new Error(`TTS returned only ${buf.length} bytes`);
  const pricePerChar = model.includes("multilingual") || /eleven-v[34]$/.test(model) ? 0.00004 : 0.00002;
  const cost = (await generationCost(res.headers.get("x-generation-id"))) ?? text.length * pricePerChar;
  return { audio: buf, cost };
}

/** Speech to text with word timestamps. */
export async function transcribe(file, { model = config.sttModel } = {}) {
  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([await readFile(file)], { type: "audio/mpeg" }), "voice.mp3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await http(`${BASE}/audio/transcriptions`, { method: "POST", headers: headers(), body: form }, 180_000);
  const d = await res.json();
  if (!d.words?.length) throw new Error("transcription returned no word timings");
  return { words: d.words.map((w) => ({ text: w.word, start: w.start, end: w.end })), text: d.text, cost: d.usage?.cost ?? 0 };
}

/** Text-to-video (async job): submit, poll until done, download. Returns { video: Buffer, cost }. */
export async function generateVideo({ model, prompt, duration = 4, resolution = "1080p", aspectRatio = "9:16", timeoutMs = 480_000 }) {
  const res = await http(`${BASE}/videos`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model, prompt, duration, resolution, aspect_ratio: aspectRatio, generate_audio: false }),
  }, 60_000);
  const job = await res.json();
  if (!job.id) throw new Error(`video job not created: ${JSON.stringify(job).slice(0, 200)}`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await new Promise((r) => setTimeout(r, 8000));
    const s = await (await http(`${BASE}/videos/${job.id}`, { headers: headers() }, 30_000)).json();
    if (/fail|error|cancel/i.test(s.status || "")) throw new Error(`video job ${s.status}: ${JSON.stringify(s.error || s).slice(0, 200)}`);
    if (s.status === "completed") {
      const url = s.unsigned_urls?.[0] || `${BASE}/videos/${job.id}/content?index=0`;
      const v = await http(url, { headers: headers() }, 120_000);
      return { video: Buffer.from(await v.arrayBuffer()), cost: s.usage?.cost ?? 0 };
    }
  }
  throw new Error(`video job timed out after ${Math.round(timeoutMs / 1000)}s`);
}

/** Music generation (Lyria via chat completions; audio output must be streamed). Returns { audio: Buffer, cost }. */
export async function generateMusic(prompt, { model = "google/lyria-3-pro-preview" } = {}) {
  const res = await http(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], modalities: ["text", "audio"], audio: { format: "mp3" }, stream: true }),
  }, 300_000);
  let buf = "", cost = 0;
  const chunks = [];
  for await (const c of res.body) {
    buf += Buffer.from(c).toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:") || line.endsWith("[DONE]")) continue;
      try {
        const j = JSON.parse(line.slice(5));
        const a = j.choices?.[0]?.delta?.audio?.data;
        if (a) chunks.push(Buffer.from(a, "base64"));
        if (j.usage?.cost != null) cost = j.usage.cost;
      } catch {}
    }
  }
  const audio = Buffer.concat(chunks);
  if (audio.length < 50_000) throw new Error(`music generation returned ${audio.length} bytes`);
  return { audio, cost };
}
