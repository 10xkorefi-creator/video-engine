# Blog → Shorts pipeline: Phase 1 plan

Status: **waiting for approval** (Phase 1). Date: 2026-10-15.

## 1. What we copy from Thinketh (faceless)

Source note: I could not watch Thinketh's Shorts. This sandbox only reaches package registries, and the web tools could not open YouTube. Points marked *(genre)* come from analysis of the Indian business-explainer genre. Before I lock the template, please send 3 Shorts you like, or allow youtube.com so I can time them myself.

| Element | What v1 will do |
|---|---|
| Script | 130–150 words (45–55 s at ~165 wpm). Beats: **hook (≤2 s) → background → investigation → twist → moral → CTA (“Full breakdown on aiaccountant.com”)**. Hook types: rupee figure, surprising fact, contrarian claim. |
| Voice | Confident, documentary, slightly fast. Indian English male narrator. A short pause before the twist. |
| Visual pacing | New visual every 2–3 s (~18–22 beats). Continuous Ken Burns on every shot (100→110%). Punch-in zoom on numbers. Whip/slide transitions between sections. Small shake on the twist *(genre)*. |
| Visual types | Portrait stock B-roll plus generated motion-graphic cards: big ₹ counter, stat card, “myth vs fact” split, checklist, headline-style quote card from the blog. All cards in AI Accountant brand colours (#314DD0 accent). |
| Captions | 1–3 words per line, heavy sans (Inter Display Black, already in your repo), white with a dark stroke, placed at ~62% of frame height (clear of the Shorts/Reels UI). Active word turns accent colour. Numbers and keywords turn yellow. Each word pops 90→105→100% over ~120 ms. |
| Sound | Music bed ducked ~14 dB under the voice. Whoosh on every cut, impact on number reveals, riser into the twist, ~300 ms of silence before the twist line. |

## 2. Options compared

### Script model (OpenRouter)
| Option | Quality | $/reel (≈10k in / 2k out + check) | Notes |
|---|---|---|---|
| **Claude Sonnet 5.5** ✅ | Best punchy narrative copy; reliable JSON | ~$0.04–0.06 | Script pass |
| Claude Haiku 5.5 / GPT-5 mini | Good / serviceable | ~$0.005–0.01 | Budget fallback |
| Gemini 2.5 Flash-Lite ✅ (check) | Fine for extraction/verification | <$0.002 | Fact-check pass |

**Fact guard (free, in code):** every number, ₹ amount, % and date in the script must appear in the blog text, or the script is rejected and regenerated once. A cheap LLM pass then checks every claim against the blog.

### Voice
| Option | Quality | $/reel (~850 chars) | Timestamps | Notes |
|---|---|---|---|---|
| **ElevenLabs Multilingual v2 via OpenRouter** ✅ | Best natural narration | $0.068 list ($0.034 launch promo, ends 19 Oct) | No (audio only) | Uses your existing key, no subscription |
| ElevenLabs Flash v2.5 via OpenRouter | Slightly flatter | $0.034 list | No | Fallback if cost is tight |
| ElevenLabs direct API | Same as above | $0.068 + $6/mo Starter for library voices | Yes (`/with-timestamps`) | Only if library voices fail through OpenRouter |
| Azure en-IN Neural (Prabhat/Aarav) | Good, less dramatic | ~$0.014 | Yes (WordBoundary) | New account. Container bug reported for WordBoundary |
| Sarvam Bulbul v3 | Good Indian voice | ~$0.03 | No | Cap of 2,500 chars per request |

**Untested and blocking:** whether OpenRouter accepts an ElevenLabs **Voice Library** ID, or only the 21 preset voices. The docs contradict each other. I could not make the test call because the sandbox blocks openrouter.ai. It is the first thing I will test once network access is open. If library IDs fail, the plan is a preset voice now and a $6/mo ElevenLabs Starter plan if you want a specific Indian voice.

### Word timing
| Option | Accuracy | $/reel | Notes |
|---|---|---|---|
| **ElevenLabs Scribe v2 via OpenRouter** ✅ | Word-level, typically within tens of ms | ~$0.0034 | Same key. Words are re-mapped onto the known script so the text is always exact. |
| Local Whisper (`hyperframes transcribe`) / stable-ts forced alignment | ±50–100 ms | $0 (CPU, ~10–20 s) | Automatic fallback if Scribe fails |

### Visuals
| Option | Quality | $/reel | Licence |
|---|---|---|---|
| **Pexels API, portrait video + photo** ✅ | Good generic B-roll. Indian-specific coverage is thin. | $0 | Pexels License, commercial use OK. Credit goes in the description. |
| **Generated motion-graphic cards (HTML)** ✅ | On-brand, exact numbers from the blog | $0 | Ours |
| Pixabay API ✅ (fallback) | Mixed | $0 | Pixabay licence |
| FLUX schnell (fal/Runware) AI images | Good for concepts | ~$0.02 for 5 images | Apache-2.0. Needs a new account → **v2** |
| Gemini image via OpenRouter | Very good | ~$0.04 per image | Over budget at 15 images; 1–2 hero images in v2 |
| AI video (Veo/Kling/Wan) | — | $2–6 per reel | ❌ over budget |

Mix: ~60% stock B-roll and ~40% motion cards. Every ₹ figure gets a card. No stock faces on negative beats such as tax notices or penalties (licence rule).

### Rendering
| Option | Quality | Cost | Speed (measured / estimated) |
|---|---|---|---|
| **HyperFrames 0.8.x (Apache-2.0), self-hosted Docker** ✅ | High: GSAP, CSS, kinetic captions, multi-track audio with ducking | $0 | **Measured here:** 34 s at 1080p in 3m54s on 1 worker, **2m14s on 4 workers** → ~3.5 min per 55 s reel |
| Remotion | High, best caption tooling | $100/mo company licence (>3 employees) | Similar |
| FFmpeg + ASS karaoke | Medium: limited motion design | $0 | ~1 min |
| Shotstack / Creatomate / JSON2Video | Medium, template-bound | $15–45/mo | Cloud |

HyperFrames wins: it is free, you already like its output, it ships an official render Dockerfile, and it supports variable injection (`--variables-file`).

### Music and SFX
- **SFX (whoosh, impact, riser, cash tick):** synthesised in code with the same approach as your `gen_score.py`. We own them outright, so there is zero Content ID risk.
- **Music bed:** you or I curate 4–6 tracks from Mixkit or Pixabay Music into `assets/music/`, with a `licenses/` record per track. A synthesised ambient bed is the fallback. The image stays private, because public redistribution is not allowed under those licences.

## 3. Chosen stack
OpenRouter (Sonnet 5.5 script + Flash-Lite check + ElevenLabs Multilingual v2 TTS + Scribe v2 timing) → Pexels B-roll + HTML motion cards → HyperFrames render in Docker → Supabase Storage. Orchestrated by n8n. Approval in MS Teams.

## 4. Architecture

```
 n8n (daily 09:00 IST)
   │ 1. read blog list (static, in workflow) + Supabase `reel_jobs`
   │    → next blog URL not yet used
   │ 2. POST /reels {blog_url, angle:"A"}   ─┐  (sequential, 20-min timeout,
   │ 3. POST /reels {blog_url, angle:"B"}   ─┤   retry once on failure)
   ▼                                         ▼
 reel-service (Docker, Node 22, same host as n8n, port 8080, bearer token)
   fetch blog ─► extract article text (Webflow HTML → readable text)
   ─► script LLM (JSON: title, beats[{text, visual, keyword}], caption, hashtags)
   ─► fact guard (numbers ⊂ blog) + LLM claim check   [regenerate once on fail]
   ─► TTS (ElevenLabs via OpenRouter) ─► Scribe word timings ─► map to script
   ─► assets: Pexels search per beat (cached) + motion cards
   ─► build HyperFrames composition (one template + variables.json)
   ─► render MP4 (1080×1920, 30 fps) ─► ffprobe check (40–60 s, audio present)
   ─► upload to Supabase Storage `reels/` ─► upsert row in `reel_jobs`
   ◄─ {title, script, caption, hashtags, mp4_url, cost_usd, render_s}
       or {error, failed_step}
   │
 n8n ─► MS Teams "send and wait for approval" (both reels, links + captions)
     ─► update `reel_jobs.status` = approved / rejected
     ─► on failure: Teams alert with failed_step + message
```

Each step inside the service is retried once (so one HTTP call = at most 2 tries per step). n8n retries the whole call once more. A failure response always names `failed_step` (`fetch_blog | script | fact_check | tts | timing | assets | render | upload`).

**Single Supabase table `reel_jobs`** (one row per reel): `id, blog_url, angle, status (queued|rendering|ready|approved|rejected|failed), title, script, caption, hashtags, video_url, failed_step, error, cost_usd, render_seconds, created_at, updated_at`, plus a unique constraint on (`blog_url`, `angle`). The list of unused blogs = static list minus distinct `blog_url` in the table. No other tables or views.

CLI: `node src/cli.js --blog <url> --angle <A|B|"custom angle text"> [--no-upload]`

## 5. Cost per reel (list prices, Oct 2026)

| Item | Calc | $ |
|---|---|---|
| Script, Sonnet 5.5 | ~10k in × $2/M + 2k out × $10/M (up to $3/$15) | 0.040–0.060 |
| Fact check, Flash-Lite | 8k in × $0.10/M + 0.5k out × $0.40/M | 0.001 |
| TTS, Multilingual v2 | ~850 chars × $0.08/1K | 0.068 |
| Word timing, Scribe v2 | 55 s × $0.000061/s | 0.003 |
| B-roll (Pexels), music, SFX | free / owned | 0.000 |
| Render | own server | 0.000 |
| OpenRouter credit fee | ~5.5% | 0.006 |
| **Total** | | **≈ $0.12–0.14** |
| Worst case: one script regeneration + one TTS retry | | ≈ $0.22 → mitigated by switching TTS to Flash v2.5 (−$0.034) |
| During launch promo (to 19 Oct) | TTS and STT at 50% | ≈ $0.09 |

Per month (60 reels): ~$7.5–8.5. No new subscriptions.

## 6. Risks
1. **OpenRouter + library voice ID** is untested (see above). Fallback: preset voice, or a $6/mo ElevenLabs Starter plan.
2. **Server CPU:** render takes ~3.5 min at 4 vCPU. On 2 vCPU expect ~7 min. That is fine for 2 a day, but n8n timeouts must be ≥20 min. Rendering will compete with n8n for CPU, so I cap it at `workers = nproc - 1`.
3. **HyperFrames is 0.x and releases almost daily.** I pin the exact version and Chrome build in the Dockerfile and vendor GSAP and fonts (no CDN at render time).
4. **Stock relevance:** Pexels has thin Indian SMB coverage. The LLM writes the search queries per beat, and motion cards are the fallback when nothing matches.
5. **Fact drift:** hard number guard plus LLM check, with the blog URL in every response so the reviewer can verify. The human approval step stays.
6. **Music Content ID false claims:** curated tracks with saved licences, synthesised fallback.
7. **This sandbox has no internet** beyond npm and PyPI. To test for real I need access to `openrouter.ai`, `api.pexels.com`, `pixabay.com`, `www.aiaccountant.com`, `*.supabase.co`, plus the keys (below).

## 7. Deferred to v2
AI-generated concept images (FLUX schnell, ~$0.02/reel), more templates and caption styles, auto-publishing to YouTube/IG/LinkedIn, ranking-driven blog selection (Ahrefs/GSC), A/B hooks, a custom-cloned brand voice, Hindi/Hinglish versions, and a thumbnail and cover frame.
