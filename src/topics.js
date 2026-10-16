// Topic discovery: collects real demand signals (search autocomplete, sales calls,
// competitor content, community questions, our own blogs) and clusters them into a
// ranked bank of reel topics with Sonnet. Each collector is independent: a failure
// in one is recorded in stats and never breaks the others.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT, config } from "./config.js";
import { chatJSON } from "./openrouter.js";
import { http, log as defaultLog, slugify } from "./util.js";

const OR_BASE = "https://openrouter.ai/api/v1";
const TOPICS_FILE = path.join(ROOT, "config", "topics.json");
const BLOGS_FILE = path.join(ROOT, "config", "blogs.json");
const PRODUCT_FILE = path.join(ROOT, "config", "product.md");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Privacy scrubbing: internal tables may contain names, emails, phones, firms.
// ---------------------------------------------------------------------------
const COMPANY_RX = /\b(?:[A-Z][\w&.'-]*\s+){1,4}(?:Pvt\.?|Private|Ltd\.?|Limited|LLP|Inc\.?|Corp\.?|Industries|Enterprises|Traders|Trading Co\.?|& Co\.?|& Sons|Associates|Agencies|Exports|Impex)\b\.?/g;
export function scrub(s) {
  return String(s ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, "[phone]")
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, "[gstin]")
    .replace(COMPANY_RX, "[company]")
    .replace(/\s+/g, " ")
    .trim();
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const parseMaybeJSON = (v) => {
  if (Array.isArray(v) || (v && typeof v === "object")) return v;
  if (typeof v !== "string" || !v.trim()) return [];
  try { return JSON.parse(v); } catch { return [v]; }
};
const countBy = (arr) => {
  const m = new Map();
  for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

async function getText(url, timeoutMs = 30_000) {
  const res = await http(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "*/*" } }, timeoutMs);
  return { text: await res.text(), url: res.url };
}

// ---------------------------------------------------------------------------
// 1. Google + YouTube autocomplete
// ---------------------------------------------------------------------------
export const SEEDS = [
  "gst notice", "gst return", "input tax credit", "gstr 2b", "gstr 1 3b mismatch", "e invoice", "e way bill",
  "tds", "tds return", "tally prime", "tally entry", "bank reconciliation", "bookkeeping", "accountant",
  "cash flow", "msme payment 45 days", "income tax notice business", "gst registration", "purchase bill entry",
  "balance sheet", "profit and loss", "working capital", "invoice", "audit", "gst late fee", "itc reversal",
  "debit note credit note", "reverse charge gst",
];
export const MODIFIERS = ["", " kaise", " kya hai", " how to", " penalty", " mistake", " why"];
const NAV_RX = /\b(login|log in|sign ?in|customer care|helpline|contact number|near me|apk|crack|mod|free download|download for pc|jobs?|vacancy|vacancies|recruitment|course fees|salary in|portal link|website|app download|ppt|pdf download|in hindi pdf|class 1[12]|ncert|cbse|mcq|meaning in (tamil|telugu|marathi|bengali|gujarati|kannada|malayalam))\b/i;

async function suggest(q, { yt = false, hl = "en" } = {}) {
  const u = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=in${yt ? "&ds=yt" : ""}&q=${encodeURIComponent(q)}`;
  const res = await http(u, { headers: { "User-Agent": UA } }, 15_000);
  const buf = Buffer.from(await res.arrayBuffer());
  // hl=hi responses can come back in a legacy charset; utf-8 is right for client=firefox.
  const data = JSON.parse(buf.toString("utf8"));
  return Array.isArray(data?.[1]) ? data[1].map(String) : [];
}

export async function collectAutocomplete({ log = defaultLog, seeds = SEEDS, modifiers = MODIFIERS, throttleMs = 150 } = {}) {
  const jobs = [];
  for (const s of seeds) for (const m of modifiers) {
    const q = (s + m).trim();
    jobs.push({ q, yt: false, hl: "en", src: "google" });
    jobs.push({ q, yt: true, hl: "en", src: "youtube" });
    if (["", " kaise", " kya hai"].includes(m)) jobs.push({ q, yt: false, hl: "hi", src: "google_hi" });
  }
  const found = new Map(); // query -> {query, sources:Set, hits, seed}
  let calls = 0, failures = 0;
  const lane = async (list) => {
    for (const j of list) {
      try {
        const out = await suggest(j.q, j);
        calls++;
        out.forEach((raw, i) => {
          const query = raw.toLowerCase().replace(/\s+/g, " ").trim();
          if (!query || query === j.q || NAV_RX.test(query)) return;
          const e = found.get(query) || { query, sources: new Set(), hits: 0, best_pos: 99, seed: j.q.replace(/ (kaise|kya hai|how to|penalty|mistake|why)$/, "") };
          e.sources.add(j.src);
          e.hits++;
          e.best_pos = Math.min(e.best_pos, i);
          found.set(query, e);
        });
      } catch (e) {
        failures++;
        if (failures <= 3) log(`autocomplete ${j.src} "${j.q}": ${e.message.slice(0, 120)}`);
      }
      await sleep(throttleMs);
    }
  };
  // Two lanes (Google vs YouTube endpoint), each throttled.
  await Promise.all([lane(jobs.filter((j) => j.src !== "youtube")), lane(jobs.filter((j) => j.src === "youtube"))]);
  if (!calls) throw new Error(`all ${jobs.length} autocomplete calls failed`);
  const items = [...found.values()]
    .map((e) => ({ query: e.query, sources: [...e.sources], hits: e.hits, best_pos: e.best_pos, seed: e.seed }))
    .sort((a, b) => b.sources.length - a.sources.length || b.hits - a.hits || a.best_pos - b.best_pos);
  return {
    items,
    meta: {
      calls, failures, unique: items.length,
      google: items.filter((i) => i.sources.includes("google")).length,
      youtube: items.filter((i) => i.sources.includes("youtube")).length,
      hindi: items.filter((i) => i.sources.includes("google_hi")).length,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Internal demand: Supabase (sales demos, raw questions, ChatGPT gaps, trends)
// ---------------------------------------------------------------------------
async function sbGet(table, query, { pageSize = 200, max = 600 } = {}) {
  const headers = { Accept: "application/json" };
  if (config.supabaseKey) { headers.apikey = config.supabaseKey; headers.Authorization = `Bearer ${config.supabaseKey}`; }
  const rows = [];
  for (let offset = 0; offset < max; offset += pageSize) {
    const limit = Math.min(pageSize, max - offset);
    const res = await http(`${config.supabaseUrl}/rest/v1/${table}?${query}&limit=${limit}&offset=${offset}`, { headers }, 60_000);
    const page = await res.json();
    rows.push(...page);
    if (page.length < limit) break;
  }
  return rows;
}

export async function collectSalesCalls({ days = 180, max = 600 } = {}) {
  const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const rows = await sbGet("demos",
    `select=pain_points,primary_pain,pain_theme_tags,prospect_industry,unanswered_questions,content_gaps&demo_date=gte.${since}&order=demo_date.desc`,
    { max });
  // Tag counts over the whole window (cheap single-column fetch), not just the sampled rows.
  let tagRows = rows;
  try { tagRows = await sbGet("demos", `select=pain_theme_tags&demo_date=gte.${since}`, { pageSize: 1000, max: 8000 }); } catch {}
  const tags = countBy(tagRows.flatMap((r) => parseMaybeJSON(r.pain_theme_tags)));
  // Industry: keep only the generic part (before dashes/brackets) so no firm or brand names leak.
  const industries = countBy(rows.map((r) => scrub(r.prospect_industry || "").toLowerCase().split(/\s[—–-]\s|\(|,|\//)[0].trim())
    .filter((x) => x && x.length < 45 && !/unknown|unclear|not (stated|mentioned|established)|\[company\]/.test(x)));
  const pains = [];
  const questions = [];
  const gaps = [];
  for (const r of rows) {
    if (r.primary_pain && !/^not (stated|clear|established)|no discovery/i.test(r.primary_pain)) pains.push(clip(scrub(r.primary_pain), 160));
    for (const p of parseMaybeJSON(r.pain_points)) {
      const t = typeof p === "string" ? p : p?.pain;
      if (t && !/^not (stated|clear|established)|no discovery/i.test(t)) pains.push(clip(scrub(t), 120));
    }
    for (const q of parseMaybeJSON(r.unanswered_questions)) {
      const t = typeof q === "string" ? q : q?.question; // who_asked is dropped on purpose
      if (t) questions.push(clip(scrub(t), 140));
    }
    for (const g of parseMaybeJSON(r.content_gaps)) if (typeof g === "string") gaps.push(clip(scrub(g), 100));
  }
  return {
    items: { tags, industries: industries.slice(0, 40), pains: countBy(pains), questions: countBy(questions), content_gaps: countBy(gaps) },
    meta: { demos: rows.length, demos_in_window: tagRows.length, since, pains: pains.length, questions: questions.length, content_gaps: gaps.length },
  };
}

export async function collectRawQuestions({ max = 400 } = {}) {
  const rows = await sbGet("raw_questions", "select=question,times_asked&order=times_asked.desc", { max });
  const items = countBy(rows.map((r) => clip(scrub(r.question), 160)));
  // countBy counts duplicates; add times_asked weight back
  const weight = new Map();
  for (const r of rows) { const k = clip(scrub(r.question), 160); weight.set(k, (weight.get(k) || 0) + (Number(r.times_asked) || 1)); }
  return { items: items.map(([q]) => ({ question: q, times_asked: weight.get(q) })).sort((a, b) => b.times_asked - a.times_asked), meta: { rows: rows.length } };
}

export async function collectChatgptGaps({ max = 300 } = {}) {
  const rows = await sbGet("chatgpt_gaps", "select=gap_query,recurrence&excluded=eq.false&order=recurrence.desc", { max });
  return { items: rows.map((r) => ({ query: clip(scrub(r.gap_query), 140), recurrence: r.recurrence || 1 })), meta: { rows: rows.length } };
}

export async function collectTrends({ days = 30, max = 200 } = {}) {
  const since = new Date(Date.now() - days * DAY).toISOString();
  let rows = await sbGet("trend_items", `select=title,source,published_at&published_at=gte.${since}&order=published_at.desc`, { max });
  let stale = false;
  if (!rows.length) { // table not refreshed recently: fall back to the latest items, flagged
    rows = await sbGet("trend_items", "select=title,source,published_at&order=published_at.desc", { max: 80 });
    stale = true;
  }
  return {
    items: rows.map((r) => ({ title: clip(scrub(r.title), 160), source: r.source, date: String(r.published_at || "").slice(0, 10) })),
    meta: { rows: rows.length, window_days: days, stale_fallback: stale, newest: rows[0]?.published_at?.slice(0, 10) || null },
  };
}

// ---------------------------------------------------------------------------
// 3. Competitor / industry content (sitemaps -> article titles)
// ---------------------------------------------------------------------------
const COMPETITORS = {
  tallysolutions: {
    sitemaps: ["https://tallysolutions.com/accounting_sitemap.xml", "https://tallysolutions.com/business_guides_sitemap.xml",
      "https://tallysolutions.com/gst_sitemap.xml", "https://tallysolutions.com/tally_sitemap.xml"],
    keep: (u) => /tallysolutions\.com\/(accounting|business-guides|gst|tally)\/[^/]+\/?$/.test(u),
  },
  zoho_books: { sitemaps: ["https://www.zoho.com/in/books/sitemap.xml"], keep: (u) => /\/in\/books\/.+/.test(u) && !/(pricing|signup|login|contact|partners|terms|privacy|features?\.html$)/.test(u) },
  cleartax: {
    sitemaps: ["https://cleartax.in/gst-sitemap.xml", "https://cleartax.in/tds-sitemap.xml", "https://cleartax.in/smb-sitemap.xml"],
    keep: (u) => /cleartax\.in\/s\/[^/]+$/.test(u),
  },
  suvit: { sitemaps: ["https://www.suvit.io/sitemap.xml", "https://taxone.vyapar.com/sitemap.xml"], keep: (u) => /\/(post|blog)\/[^/()]+$/.test(u) && !/\/blog\/author/.test(u) },
  vyapar: { sitemaps: ["https://vyaparapp.in/blog/post-sitemap.xml", "https://vyaparapp.in/sitemap"], keep: (u) => /vyaparapp\.in\/blog\/[^/]+\/?$/.test(u) && !/sitemap/.test(u) },
  busy: { sitemaps: ["https://busy.in/sitemap/post-sitemap0.xml", "https://busy.in/sitemap/post-sitemap1.xml"], keep: (u) => /busy\.in\/(blog|glossary|[a-z-]+)\/[^/]+\/?$/.test(u) },
};
const SKIP_SLUG = /(hsn-code|sac-code|-hsn-|gst-rate-on-|template|calculator|format-in-excel|-vs-tally$|login|careers?|webinar|press-release|case-study)/;

const slugTitle = (u) => {
  const slug = u.replace(/[?#].*$/, "").replace(/\/$/, "").split("/").pop().replace(/\.(html?|php|aspx)$/, "");
  return slug.replace(/[-_]+/g, " ").replace(/\b(gst|tds|tcs|itc|gstr|msme|faq|hsn|sac|pan|tan|erp|ai)\b/gi, (m) => m.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase()).trim();
};

async function sitemapUrls(url, depth = 0) {
  const { text } = await getText(url, 45_000);
  const entries = [...text.matchAll(/<(url|sitemap)>([\s\S]*?)<\/\1>/g)].map((m) => ({
    kind: m[1],
    loc: (m[2].match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/) || [])[1],
    lastmod: (m[2].match(/<lastmod>\s*([^<\s]+)/) || [])[1] || "",
  })).filter((e) => e.loc);
  const out = entries.filter((e) => e.kind === "url");
  const subs = entries.filter((e) => e.kind === "sitemap");
  if (depth < 1) for (const s of subs.slice(0, 6)) { try { out.push(...(await sitemapUrls(s.loc, depth + 1))); } catch {} }
  return out;
}

export async function collectCompetitors({ log = defaultLog, cap = 300 } = {}) {
  const items = {};
  const meta = {};
  await Promise.all(Object.entries(COMPETITORS).map(async ([site, def]) => {
    try {
      const all = [];
      const errs = [];
      for (const sm of def.sitemaps) {
        try { all.push(...(await sitemapUrls(sm))); } catch (e) { errs.push(`${sm}: ${e.message.slice(0, 100)}`); }
      }
      const seen = new Set();
      const kept = all.filter((e) => def.keep(e.loc) && !SKIP_SLUG.test(e.loc) && !seen.has(e.loc) && seen.add(e.loc))
        .sort((a, b) => (b.lastmod || "").localeCompare(a.lastmod || ""));
      items[site] = kept.slice(0, cap).map((e) => slugTitle(e.loc)).filter((t) => t.length > 6);
      meta[site] = { urls_seen: all.length, articles: kept.length, kept: items[site].length, ...(errs.length ? { errors: errs } : {}) };
      if (!items[site].length) meta[site].failed = errs[0] || "no article URLs matched";
    } catch (e) {
      items[site] = [];
      meta[site] = { failed: e.message.slice(0, 200) };
      log(`competitor ${site}: ${e.message.slice(0, 120)}`);
    }
  }));
  if (!Object.values(items).some((l) => l.length)) throw new Error(`no competitor titles: ${JSON.stringify(meta)}`);
  return { items, meta };
}

// ---------------------------------------------------------------------------
// 4. Community discussions (one OpenRouter web-search call; Reddit blocks direct fetch)
// ---------------------------------------------------------------------------
export async function collectCommunity({ model = config.researchModel, maxResults = 10 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (config.openrouterKey) headers.Authorization = `Bearer ${config.openrouterKey}`;
  const res = await http(`${OR_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 3000,
      reasoning: { effort: "low" },
      usage: { include: true },
      plugins: [{ id: "web", max_results: maxResults }],
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You find real questions Indian small-business founders, finance heads and in-house accountants ask online. Today: ${new Date().toISOString().slice(0, 10)}. Only report questions you actually saw in search results (Reddit r/IndiaTax, r/IndianStartups, r/CAIndia, r/smallbusinessindia, Quora, Tally/GST forums). Return ONLY JSON: {"questions":[{"question":"the question as asked, paraphrased only to remove names","url":"https://...","theme":"gst|tds|tally|bookkeeping|cash_flow|notices|other"}]}. 10-20 items, no personal names.` },
        { role: "user", content: "Search for the most-discussed recent founder/accountant pain questions in India about GST notices, GSTR-2B/ITC mismatch, TDS, Tally entries, bookkeeping, accountant dependency, and cash flow / MSME payments. Use searches like: site:reddit.com IndiaTax GST notice small business; site:reddit.com CAIndia Tally; site:quora.com GST input tax credit mismatch business." },
      ],
    }),
  }, 180_000);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  let json = {};
  try { json = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)); } catch {}
  const cited = (data.choices?.[0]?.message?.annotations || []).map((a) => a.url_citation?.url).filter(Boolean);
  const items = (json.questions || []).filter((q) => q.question).map((q) => ({ question: clip(scrub(q.question), 200), url: q.url || null, theme: q.theme || "other" }));
  return { items, meta: { questions: items.length, cited_urls: cited.length }, cost: data.usage?.cost ?? 0 };
}

// ---------------------------------------------------------------------------
// 5. Our own blogs (GSC clicks)
// ---------------------------------------------------------------------------
export async function collectBlogs() {
  const blogs = JSON.parse(readFileSync(BLOGS_FILE, "utf8"));
  return { items: blogs.map((b) => ({ url: b.url, title: slugTitle(b.url), clicks: b.clicks, impressions: b.impressions })), meta: { blogs: blogs.length } };
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------
const take = (arr, maxChars, fmt) => {
  const out = [];
  let n = 0;
  for (const x of arr) {
    const s = fmt(x);
    if (n + s.length + 1 > maxChars) break;
    out.push(s);
    n += s.length + 1;
  }
  return out.join("\n");
};

function buildSignalText(sig) {
  const parts = [];
  const ac = sig.autocomplete?.items;
  if (ac?.length) {
    parts.push(`## AUTOCOMPLETE (real Google/YouTube India queries; format: query [g=google,y=youtube,h=hindi])\n` +
      take(ac, 30_000, (i) => `${i.query} [${i.sources.map((s) => (s === "google" ? "g" : s === "youtube" ? "y" : "h")).join("")}]`));
  }
  const sc = sig.sales_calls?.items;
  if (sc) {
    parts.push(`## SALES CALLS (${sig.sales_calls.meta.demos} most recent of ${sig.sales_calls.meta.demos_in_window} AI-analysed demos with SMB prospects, last 180 days; aggregated, anonymised)
Pain theme tag counts (all ${sig.sales_calls.meta.demos_in_window} demos): ${sc.tags.map(([t, c]) => `${t} ${c}`).join(", ")}
Prospect industries: ${sc.industries.slice(0, 25).map(([t, c]) => `${t} (${c})`).join("; ")}
### Pains (xN = repeated)\n${take(sc.pains, 34_000, ([p, c]) => (c > 1 ? `${p} x${c}` : p))}
### Unanswered prospect questions\n${take(sc.questions, 12_000, ([p, c]) => (c > 1 ? `${p} x${c}` : p))}
### Content gaps flagged\n${take(sc.content_gaps, 8_000, ([p, c]) => (c > 1 ? `${p} x${c}` : p))}`);
  }
  if (sig.raw_questions?.items?.length) parts.push(`## QUESTIONS ASKED ON SALES CALLS (times asked)\n${take(sig.raw_questions.items, 12_000, (q) => `${q.question} (${q.times_asked})`)}`);
  if (sig.chatgpt_gaps?.items?.length) parts.push(`## CHATGPT/AI-SEARCH QUERIES WHERE WE DON'T RANK (recurrence)\n${take(sig.chatgpt_gaps.items, 8_000, (q) => `${q.query} (${q.recurrence})`)}`);
  if (sig.trends?.items?.length) parts.push(`## RECENT NEWS HEADLINES${sig.trends.meta.stale_fallback ? " (latest available, older than 30 days)" : " (last 30 days)"}\n${take(sig.trends.items, 7_000, (t) => `${t.date} ${t.title}`)}`);
  if (sig.competitor?.items) {
    parts.push(`## COMPETITOR CONTENT TITLES (newest first; shows what they invest in)\n` +
      Object.entries(sig.competitor.items).filter(([, l]) => l.length).map(([site, l]) => `### ${site}\n${take(l, 9_000, (t) => t).split("\n").join(" | ")}`).join("\n"));
  }
  if (sig.community?.items?.length) parts.push(`## COMMUNITY QUESTIONS (Reddit/Quora via web search)\n${sig.community.items.map((q) => `${q.question} (${q.url || "no url"})`).join("\n")}`);
  if (sig.blog?.items?.length) parts.push(`## OUR BLOGS (url, Search Console clicks)\n${sig.blog.items.map((b) => `${b.url} ${b.clicks}`).join("\n")}`);
  return parts.join("\n\n");
}

const SOURCES = ["autocomplete", "youtube", "sales_calls", "chatgpt", "competitor", "community", "blog", "news"];
const ANGLES = ["founder mistake story", "myth vs reality", "why behind the rule", "smart founders vs others", "what happens if you ignore it", "explained in 60 seconds", "hidden cost"];
const AUDIENCES = ["founder", "finance_head", "accountant", "ceo"];

function clusterPrompt(productSummary, target) {
  return `You are the content strategist for "AI Accountant", making 40-60 s educational explainer Shorts/Reels (Hinglish and English) for Indian SMBs (Rs 1-100 crore turnover).
AUDIENCE: founders / owners / CEOs, finance heads, and in-house accountants. NOT CA firms or practising CAs.
PRODUCT CONTEXT (only to judge aia_fit):\n${productSummary}

TASK: From the demand signals provided, produce ${target} distinct reel topics that represent REAL, evidenced demand. Topics are educational and engaging explainers on accounting, bookkeeping, GST, TDS, Tally, and finance-ops problems. Not every topic should be about AI Accountant.
Rules:
- Merge near-duplicate signals into one topic; each topic must be specific enough for a 60 s reel (one problem, one question), and different from every other topic.
- Ground every topic in the signals. "examples" must be 3-5 real query/question snippets copied (lightly trimmed) from the signals, never invented. No personal names, emails, phones or company names.
- "sources" lists ONLY the signal sections that actually contain evidence: autocomplete (Google/Hindi autocomplete), youtube (queries tagged y), sales_calls (sales-call pains/questions/raw questions), chatgpt (AI-search gap queries), competitor, community, blog, news.
- signal_score 1-10 = strength of demand: volume and repetition (many autocomplete variants, xN counts, times asked, high blog clicks) and diversity of sources.
- Exclude navigational / brand / login / download queries, product-pricing or "does your software do X" sales questions as topics in themselves, HSN-code lookups, personal income tax (salaried ITR), and CA practice-management topics. Product questions from sales calls should be turned into the underlying business problem (e.g. "handwritten bills take hours to enter").
- aia_fit: "direct" = AI Accountant solves it per the product context (bill entry, bank reconciliation, GSTR-2B matching, duplicates, accountant dependency, real-time numbers, payables/receivables visibility in Tally); "indirect" = related finance-ops hygiene where AiA helps partly; "none" = pure education (tax rules, concepts). Aim for about 40% direct, the rest indirect/none.
- audience: subset of ${JSON.stringify(AUDIENCES)}. language_fit: subset of ["english","hinglish"] (hinglish if Hindi/"kaise"/"kya hai" demand exists or the topic suits mass SMB owners).
- suggested_angles: 2-3 from ${JSON.stringify(ANGLES)}.
- related_blog: an exact URL from OUR BLOGS if one clearly matches, else null.
- evergreen: false if tied to a deadline, a recent rule change or news.
- title: plain, founder-facing (no jargon-only titles); problem: the real question in one line; why_it_matters: one line on money/time/risk.
- id: short kebab-case slug, unique.
Return ONLY JSON: {"topics":[{"id":"","title":"","problem":"","audience":[],"why_it_matters":"","evidence":{"sources":[],"signal_score":0,"examples":[]},"suggested_angles":[],"aia_fit":"","language_fit":[],"related_blog":null,"evergreen":true}]}
Order by demand strength, strongest first. Keep each string concise (examples under 90 characters each).`;
}

const AUD_W = { founder: 1.5, ceo: 1.2, finance_head: 1.0, accountant: 0.6 };

/** priority = demand evidence (score + source diversity) + audience fit. */
export function priorityOf(t) {
  const src = new Set(t.evidence?.sources || []);
  const searchBoth = src.has("autocomplete") && src.has("youtube") ? 0.5 : 0;
  const internal = src.has("sales_calls") ? 1 : 0; // our own prospects asked for it
  const aud = Math.max(0, ...(t.audience || []).map((a) => AUD_W[a] || 0));
  return Number(((t.evidence?.signal_score || 0) + Math.min(src.size, 6) * 0.9 + searchBoth + internal + aud + (t.evergreen ? 0.3 : 0)).toFixed(2));
}

function normaliseTopics(raw, blogs) {
  const blogUrls = new Set(blogs.map((b) => b.url));
  const ids = new Set();
  const pick = (arr, allowed) => [...new Set((Array.isArray(arr) ? arr : [arr]).filter((x) => allowed.includes(x)))];
  const out = [];
  for (const t of raw || []) {
    if (!t?.title) continue;
    let id = slugify(t.id || t.title) || slugify(t.title);
    while (ids.has(id)) id += "-2";
    ids.add(id);
    const ev = t.evidence || {};
    const topic = {
      id,
      title: scrub(t.title),
      problem: scrub(t.problem || ""),
      audience: pick(t.audience, AUDIENCES),
      why_it_matters: scrub(t.why_it_matters || ""),
      evidence: {
        sources: pick(ev.sources, SOURCES),
        signal_score: Math.max(1, Math.min(10, Math.round(Number(ev.signal_score) || 1))),
        examples: (ev.examples || []).map((x) => clip(scrub(x), 120)).filter(Boolean).slice(0, 5),
      },
      suggested_angles: (t.suggested_angles || []).filter(Boolean).slice(0, 4),
      aia_fit: ["direct", "indirect", "none"].includes(t.aia_fit) ? t.aia_fit : "none",
      language_fit: pick(t.language_fit, ["english", "hinglish"]),
      related_blog: blogUrls.has(t.related_blog) ? t.related_blog : null,
      evergreen: t.evergreen !== false,
    };
    if (!topic.audience.length) topic.audience = ["founder"];
    if (!topic.language_fit.length) topic.language_fit = ["english", "hinglish"];
    topic.priority = priorityOf(topic);
    out.push(topic);
  }
  out.sort((a, b) => b.priority - a.priority);
  out.forEach((t, i) => { t.rank = i + 1; });
  return out;
}

const productSummary = () => {
  try {
    const md = readFileSync(PRODUCT_FILE, "utf8");
    const a = md.indexOf("## 1."), b = md.indexOf("## 4.");
    return clip(md.slice(a > 0 ? a : 0, b > a ? b : 5000), 5000);
  } catch { return "AI automation layer on top of TallyPrime: reads bank statements and vendor bills, maps to ledgers, matches payments, GSTR-2B reconciliation, posts to Tally after review."; }
};

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export async function discoverTopics({ log = defaultLog, target = 72, clusterModel = config.scriptModel, cluster = true, only = null } = {}) {
  const collectors = {
    autocomplete: () => collectAutocomplete({ log }),
    sales_calls: () => collectSalesCalls(),
    raw_questions: () => collectRawQuestions(),
    chatgpt_gaps: () => collectChatgptGaps(),
    trends: () => collectTrends(),
    competitor: () => collectCompetitors({ log }),
    community: () => collectCommunity(),
    blog: () => collectBlogs(),
  };
  const signals = {};
  const stats = {};
  const cost = { community: 0, clustering: 0, total: 0 };
  await Promise.all(Object.entries(collectors).filter(([n]) => !only || only.includes(n)).map(async ([name, fn]) => {
    const t0 = Date.now();
    try {
      const r = await fn();
      signals[name] = r;
      if (r.cost) cost[name] = r.cost;
      stats[name] = { ok: true, seconds: Number(((Date.now() - t0) / 1000).toFixed(1)), ...r.meta };
      log(`✔ ${name}: ${JSON.stringify(r.meta).slice(0, 220)}`);
    } catch (e) {
      stats[name] = { ok: false, error: e.message.slice(0, 300) };
      log(`✖ ${name}: ${e.message.slice(0, 200)}`);
    }
  }));

  const signalText = buildSignalText(signals);
  stats.clustering = { input_chars: signalText.length, approx_input_tokens: Math.round(signalText.length / 3.8) };
  if (!cluster) return { topics: [], stats, cost, signals, signalText };
  log(`clustering ${signalText.length} chars (~${stats.clustering.approx_input_tokens} tokens) with ${clusterModel}`);
  const blogs = signals.blog?.items || [];
  const { json, cost: cCost, usage } = await chatJSON({
    model: clusterModel,
    system: clusterPrompt(productSummary(), target),
    user: `DEMAND SIGNALS\n\n${signalText}`,
    maxTokens: 16000,
    temperature: 0.4,
  });
  cost.clustering = cCost;
  cost.total = Number((cost.community + cost.clustering).toFixed(5));
  stats.clustering.usage = usage ? { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens } : null;
  const topics = normaliseTopics(json.topics, blogs);
  const fit = countBy(topics.map((t) => t.aia_fit));
  stats.clustering.topics = topics.length;
  stats.clustering.aia_fit = Object.fromEntries(fit);
  return { topics, stats, cost, signals, signalText };
}

// ---------------------------------------------------------------------------
// Using the bank
// ---------------------------------------------------------------------------
/** Topics from config/topics.json, or CACHE_DIR/topics.json when it exists and is newer. */
export function loadTopics() {
  const cached = path.join(config.cacheDir, "topics.json");
  let file = TOPICS_FILE;
  if (existsSync(cached) && (!existsSync(TOPICS_FILE) || statSync(cached).mtimeMs > statSync(TOPICS_FILE).mtimeMs)) file = cached;
  if (!existsSync(file)) return [];
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const topics = Array.isArray(doc) ? doc : doc.topics || [];
  return [...topics].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Next `count` unused topics by priority. Rotates aia_fit so consecutive picks
 * differ when a candidate within the next few by priority allows it.
 */
export function nextTopics(usedIds = [], count = 2, { topics = loadTopics(), lastFit = null, window = 6 } = {}) {
  const used = new Set(usedIds);
  const pool = topics.filter((t) => !used.has(t.id));
  const picks = [];
  let prev = lastFit;
  while (picks.length < count && pool.length) {
    let idx = pool.findIndex((t, i) => i < window && t.aia_fit !== prev);
    if (idx < 0) idx = 0;
    const [t] = pool.splice(idx, 1);
    picks.push(t);
    prev = t.aia_fit;
  }
  return picks;
}
