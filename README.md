# reel-engine

Turns an AI Accountant blog post into a 40–60 s faceless, voice-led vertical explainer (1080×1920 MP4) for YouTube Shorts, Instagram Reels and LinkedIn.
The blog sets the **topic direction**. The engine researches it on the web and writes an **original Hinglish story** around the most gripping fact.
n8n triggers it daily, makes 2 reels (angles A and B), and sends both to MS Teams for approval.

```
blog URL ─► fetch ─► web research (sourced facts + blog-conflict flags) ─► script (Sonnet, Hinglish, hook ≤2 s)
        ─► number guard + LLM fact check (blog + sources only) ─► voice (ElevenLabs v3 via OpenRouter)
        ─► word timings (Scribe v2) ─► Roman-Hinglish captions ─► Pixabay footage + brand cards
        ─► HyperFrames render (GSAP, kinetic captions, SFX, ducked music) ─► Supabase Storage + reel_jobs row
```

## Input / output

`POST /reels` (header `Authorization: Bearer $SERVICE_TOKEN`)

```json
{ "blog_url": "https://www.aiaccountant.com/blog/tds-filing-due-date", "angle": "A" }
```

`angle` is `A` (costly mistake), `B` (contrarian take) or any free-text angle. The call is synchronous and takes about 4–6 minutes. Renders run one at a time and are queued.

Success (`200`):

```json
{ "ok": true, "title": "...", "script": "...", "caption": "... #GST #TDS",
  "video_url": "https://<project>.supabase.co/storage/v1/object/public/reels/2026-10-15/tds-filing-due-date-A.mp4",
  "duration_s": 54.4, "hook_first_sentence_s": 0.96, "render_seconds": 169,
  "cost_usd": { "research_llm": 0.047, "script_llm": 0.036, "tts": 0.028, "...": 0, "total": 0.115 },
  "keyword": "TDS due dates FY 2026-27", "research_sources": ["https://..."], "blog_conflicts": ["Blog says ..."] }
```

Failure (`500`): `{ "ok": false, "failed_step": "fact_check", "error": "..." }`.
`failed_step` is one of `fetch_blog | research | script | fact_check | tts | timing | captions | assets | compose | render | verify | upload`.
Each step is retried once inside the service, and n8n retries the whole call once more.

`GET /health` returns `{ ok, queued }`.

## Local test (CLI)

```bash
npm ci
cp .env.example .env    # fill in keys
node src/cli.js --blog https://www.aiaccountant.com/blog/gst-on-freight-charges --angle B
node src/cli.js --blog <url> --angle "why founders overpay GST on transport" --no-upload
```

Output goes to `out/<date>-<slug>-<angle>/`. It contains the MP4, `report.json` (script, costs, timings, sources) and `project/`, the HyperFrames composition. To preview it, run `npx hyperframes preview` inside that folder.

## Deploy next to n8n (Docker)

1. Supabase (once): run `sql/reel_jobs.sql` and create a **public** bucket `reels` (mp4 only). Both already exist in the *AI Accountant* project.
2. On the server:
   ```bash
   git clone <repo> reel-engine && cd reel-engine
   cp .env.example .env && nano .env          # keys + a long random SERVICE_TOKEN
   docker network ls                          # find n8n's network, e.g. n8n_default
   N8N_NETWORK=n8n_default docker compose up -d --build
   docker exec reel-engine curl -s localhost:8080/health
   ```
3. n8n: open the workflow **Blog → Shorts Reels (daily)**, which is already in your n8n and **inactive**. You can also import `n8n/workflow.json`. Then:
   - **Make Reel A / B**: create an *HTTP Bearer Auth* credential "Reel Engine Token" with `SERVICE_TOKEN`. The URL `http://reel-engine:8080/reels` works when both containers share a network.
   - **Send to Teams**: pick your Microsoft Graph OAuth2 credential and replace `REPLACE_WITH_TEAMS_CHAT_ID` in the URL.
   - **Get Used Blogs / Update Reel Status**: check that the Supabase credential points at the AI Accountant project.
   - **Pick Next Blog**: holds the ranked blog list (Search Console clicks). Edit it freely.
   - Activate the workflow. It runs daily at 09:00 IST.

Sizing: about 3 minutes of render per reel on 4 vCPU, so a 2-vCPU box needs about 6–7 minutes. Keep the n8n HTTP timeout at 25 minutes or more (already set).

## Cost per reel (measured)

| Step | Model | $ |
|---|---|---|
| Web research (shared by A and B) | Haiku 5.5 + web search | ~0.025–0.047 |
| Script, plus 1 rewrite if needed | Sonnet 5.5 | ~0.035–0.07 |
| Fact check, caption transliteration | Haiku 5.5 | ~0.002 |
| Voice | ElevenLabs v3 via OpenRouter | ~0.03 (promo) / ~0.06 (list) |
| Word timings | Scribe v2 | ~0.002 |
| Footage, music, SFX, render | Pixabay (free), owned audio, own server | 0 |
| **Total** | | **~$0.10–0.12 now, ~$0.15–0.17 at list price** |

## Licensing

- **Footage and photos:** Pixabay Content License. Commercial use is allowed with no attribution, and every reel is a derivative work. Credits are recorded in `report.json` under `media_credits`.
- **Music and SFX** (`template/assets/audio`): synthesised from scratch by `tools/gen_audio.py`. We own them, so there's no Content ID risk.
- **Fonts:** Inter (OFL). **GSAP:** standard no-charge license.

## Config

See `.env.example`. Useful switches:
- `LANGUAGE=english`
- `TTS_VOICE=<voice-library id>` (Hinglish); `TTS_VOICE_EN` / `TTS_MODEL_EN` override it for English reels
- `RESEARCH_RESULTS=0` turns web research off, so scripts come from the blog only.
