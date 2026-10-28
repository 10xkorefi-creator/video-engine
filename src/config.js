import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env loader (no dependency). Real env vars win.
const envFile = path.join(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);

export const config = {
  port: Number(env("PORT", 8080)),
  serviceToken: env("SERVICE_TOKEN", ""), // bearer token n8n must send; empty = no auth

  // Keys are optional: when absent we send no auth header and rely on an
  // egress proxy that injects credentials (cloud sandbox). On a normal server set them.
  openrouterKey: env("OPENROUTER_API_KEY", ""),
  pixabayKey: env("PIXABAY_API_KEY", ""),
  pexelsKey: env("PEXELS_API_KEY", ""), // optional second stock library
  supabaseUrl: env("SUPABASE_URL", "https://qmaphtslnvvifkzmbrvh.supabase.co").replace(/\/$/, ""),
  supabaseKey: env("SUPABASE_SERVICE_KEY", ""),
  supabaseBucket: env("SUPABASE_BUCKET", "reels"),
  supabaseTable: env("SUPABASE_TABLE", "reel_jobs"),

  scriptModel: env("SCRIPT_MODEL", "anthropic/claude-sonnet-5.5"),
  checkModel: env("CHECK_MODEL", "anthropic/claude-haiku-5.5"),
  researchModel: env("RESEARCH_MODEL", "anthropic/claude-haiku-5.5"),
  researchResults: Number(env("RESEARCH_RESULTS", 6)), // web results per reel (~$0.004 each)
  language: env("LANGUAGE", "english"), // hinglish | english
  ttsModel: env("TTS_MODEL", "elevenlabs/eleven-v3"),
  ttsVoice: env("TTS_VOICE", "4yF24b9emqK8f4DBqL2Q"),
  // English reels use their own voice; empty falls back to TTS_MODEL / TTS_VOICE.
  ttsModelEn: env("TTS_MODEL_EN", ""),
  ttsVoiceEn: env("TTS_VOICE_EN", "RpiHVNPKGBg7UmgmrKrN"), // Aashish (Indian English)
  voiceSpeed: Number(env("VOICE_SPEED", "1.07")), // 1 = raw TTS pace
  // AI B-roll (OpenRouter video). Empty AI_VIDEO_MODEL = stock footage only.
  aiVideoModel: env("AI_VIDEO_MODEL", "google/veo-3.1-lite"),
  aiVideoResolution: env("AI_VIDEO_RESOLUTION", "1080p"),
  // Per-reel custom score (OpenRouter Lyria). Empty MUSIC_MODEL = built-in synth beds.
  musicModel: env("MUSIC_MODEL", "google/lyria-3-pro-preview"),
  sttModel: env("STT_MODEL", "elevenlabs/scribe-v2"),

  minSeconds: Number(env("MIN_SECONDS", 40)),
  maxSeconds: Number(env("MAX_SECONDS", 60)), // default short reel
  maxLongSeconds: Number(env("MAX_LONG_SECONDS", 180)), // only when the story needs it
  renderWorkers: Number(env("RENDER_WORKERS", Math.max(1, os.cpus().length - 1))),
  renderQuality: env("RENDER_QUALITY", "standard"),
  workDir: env("WORK_DIR", path.join(ROOT, "out")),
  cacheDir: env("CACHE_DIR", path.join(ROOT, "cache")),
};
