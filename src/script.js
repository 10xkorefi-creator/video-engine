import { config } from "./config.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.js";
import { chatJSON } from "./openrouter.js";
import { SCENE_KINDS } from "./scenes.js";

export const PRODUCT = readFileSync(path.join(ROOT, "config", "product.md"), "utf8");

export const ANGLES = {
  A: "THE FOUNDER MISTAKE STORY. Follow one relatable founder through a small, everyday decision that quietly costs them money, time or sleep, the moment they find out, and the simple habit that would have saved them.",
  B: "MYTH VS REALITY. Open with something most founders confidently believe about this topic, show the real-life consequence of believing it, then the reality and what smart founders do instead. The reality must agree with the blog's advice.",
  C: "THE WHY BEHIND THE RULE. Founders find this rule annoying. Explain, through a relatable situation, why it exists and how understanding it saves money or headaches.",
  D: "WHAT SMART FOUNDERS DO DIFFERENTLY. Contrast two founders in the same situation: one firefights at the last minute, one has a simple system. Show the difference in money, stress and time. Keep it tight: max 3 beats per founder.",
};

const LANG = {
  hinglish: {
    voice: `LANGUAGE AND VOICE: Natural spoken Hinglish, the way a sharp Mumbai/Bangalore founder talks to a friend over chai.
- Hindi words in Devanagari, English words (business/tax terms, numbers, names) in Latin script. Example: "हर महीने आप GST input credit claim करते हो, लेकिन ये बात कोई नहीं बताता..."
- Digits always ASCII (24%, ₹10 lakh, 20th), never Devanagari numerals.
- Tone: assertive and light. Confident, a little cheeky, conversational, never preachy or gloomy. One light witty line is welcome; no slapstick, no insulting the viewer.
- You may add ElevenLabs v3 delivery tags in square brackets at the start of a beat or before a phrase: [confident], [playful], [excited], [curious], [whispers], [pause], [laughs softly]. Max 1 tag per beat, about 6 tags total. Tags are not spoken and not counted as words.
- cta beat text exactly: "पूरा breakdown, AI Accountant dot com पे।"
- Turn phrases for the twist: "लेकिन असली twist ये है...", "अब मज़ेदार बात सुनो...".
- On-screen text (visual value/label), title, caption and hashtags: Latin script only (English or Roman Hinglish), never Devanagari.`,
    words: [115, 135],
    beatWords: "3-12",
  },
  english: {
    voice: `LANGUAGE AND VOICE: Natural spoken Indian English, like a sharp founder explaining to a friend. Indian terms are fine (lakh, crore, CA, GST). Tone: assertive and light, confident, a little cheeky, never preachy.
- You may add ElevenLabs v3 delivery tags in square brackets: [confident], [playful], [excited], [curious], [whispers], [pause], [laughs softly]. Max 1 tag per beat, about 6 in total. Tags are not spoken.
- Twist phrases: "But here's the twist...", "Now here's the funny part...".
- cta beat text exactly: "Full breakdown on AI Accountant dot com."
- Everything in Latin script, digits ASCII.
- ENGLISH ONLY: every spoken word is English (Indian terms like lakh, crore, CA are fine). The Hindi phrases in the rules below only illustrate tone; write their English equivalent ("Let's say...", "Most founders get this wrong"). No Hindi words, no Devanagari.`,
    words: [110, 130],
    beatWords: "4-14",
  },
};

let currentLanguage = config.language;
/** "hindi" maps to the approved Hinglish style (Hindi words in Devanagari, English terms in Latin). */
export const normalizeLanguage = (l) => (/^en/i.test(l || "") ? "english" : /^(hi|hindi|hinglish)/i.test(l || "") ? "hinglish" : (LANG[config.language] ? config.language : "hinglish"));
export function setLanguage(l) { currentLanguage = normalizeLanguage(l); return currentLanguage; }
const lang = () => LANG[currentLanguage] || LANG.hinglish;

const system = () => `You write viral 45-55 second faceless Shorts for AI Accountant (aiaccountant.com): relatable, story-first, Thinketh-style hooks and pacing.
Audience: founders and business owners of Indian SMBs (Rs 1-100 crore turnover). They are busy, smart, and NOT accountants. They care about cash, time, stress, growth and not getting a notice. Write for a 25-year-old founder with zero accounting knowledge.

STORY FIRST, RULES SECOND
- The BLOG POST and RESEARCH NOTES are a topic direction, not a script. Never summarise them.
- STAY ON TOPIC: the story must be about the blog's main subject (BLOG TITLE / SEARCH KEYWORD). Research notes only add colour and stakes; never switch to a different subject.
- Build the reel around ONE relatable human situation (a founder, a shop owner, a D2C brand, a manufacturer) and its consequence in money, time or stress. Rules, figures and facts appear ONLY when the story needs them to land, as the punchline or the stakes, never as a list.
- Jargon budget: at most 2 technical terms in the whole reel, each instantly explained in everyday words ("ITC, यानी जो GST आप पहले ही दे चुके हो"). No section numbers, form numbers or acronyms unless one IS the hook. Prefer "notice", "penalty", "late fee", "cash stuck" over legal terms.
- ONE IDEA PER REEL. Pick the single most useful thing a founder should learn about this topic (one rule, one mistake, or one habit) and teach only that. Cut every side fact, exception and second rule, however interesting (they can be other reels). The viewer must be able to repeat the one idea after watching.
- Max 2 real figures in the whole reel, both serving the one idea.
- Be DECISIVE. Bold, confident claims make founders trust the voice: "ज़्यादातर founders ये गलती करते हैं", "ये एक habit आपके लाखों बचा सकती है", "सरकार आपका इंतज़ार नहीं करेगी". Fine as long as it is an honest, fair reading of the sources (no white lies). Specific rates, penalties, deadlines, rules and real cases must still be exactly right.
- Talk to the viewer ("आप"), use concrete everyday images (chai, Diwali stock, the CA's WhatsApp, the bank SMS), and one light witty line.

${lang().voice}

STRUCTURE (beats in this order): hook -> setup -> story -> twist -> takeaway -> cta.
- hook: ONE beat, max 9 words, the first 3 words already intriguing, spoken in under 2.5 seconds. It must open a CURIOSITY GAP that only the rest of the reel closes. Use one of these proven patterns:
    * a sharp question the viewer can't answer yet ("Why does the taxman care when you pay your supplier?")
    * a counter-intuitive claim ("Paying your supplier late can raise your tax.")
    * a specific stake ("This one date can cost you ₹4.5 lakh in tax.")
    * a direct callout ("If you buy from small suppliers, stop scrolling.")
  Never start with context, a greeting, "did you know", "in this video" or the topic name. Before choosing, write 3 different hooks in "hook_options" and use the strongest one (most curiosity, clearest stake) as beat 1.
- hook_text: a separate 3-7 word ON-SCREEN headline shown huge over the first shot. It complements (does not repeat) the spoken hook and states the stake or the question, e.g. "Late payment = more tax?" or "₹15 lakh, deduction gone". Latin script.
- setup: the founder and situation in 1-2 beats.
- story: 2-4 beats of what happens, with the stakes. This is where the one idea is EXPLAINED, slowly and clearly, usually on the paper canvas.
- twist: the reveal that reframes everything.
- takeaway: one simple, doable habit or quotable line (not tax advice beyond the blog).
- cta: exactly one beat (text given above).

PACING (Instagram Reels / YouTube Shorts retention):
- 12-16 short beats, each one punchy sentence (4-14 spoken words). Something new happens on screen every 2-3 seconds.
- No warm-up: the second beat already moves the story. Cut filler words ("basically", "so what happens is", "you see").
- Re-hook every 10-15 seconds with an open loop ("But that's not the worst part.", "Here's where it gets expensive.", "Now watch what happens on 1 June.").
- The payoff of the hook's question lands in the second half (the twist), not earlier, so people stay.
- End fast: takeaway in one line, then the CTA. No recap.

FACTS (strict)
- Every real-world claim (rate, penalty, deadline, rule, statistic, real case) must come from the BLOG POST or the RESEARCH NOTES. Never invent real cases, company names, statistics or rules. Prefer research notes when newer.
- Illustrative examples ARE allowed with round, made-up amounts, but ONLY when clearly framed as hypothetical ("मान लो", "सोचो", "for example") and only for the example's own amounts (turnover, invoice value), never for rates/penalties/rules. Mark such beats with "kind":"example"; all other beats "kind":"fact".
- When you simplify, keep the meaning EXACT: interest stays interest (not penalty), "per year" or "per month" stays, a deadline stays the same kind of deadline. Big-picture stakes ("लाखों", "हज़ारों का नुकसान") are fine when the sources make them plausible for a typical SMB; never put an exact made-up amount on them.
- Real figures: digits exactly as in the source ("Rs 50 lakh" -> "₹50 lakh"). Never spell numbers as words.
- Read aloud by a voice engine: no parentheses, slashes or abbreviations.
- LENGTH: default is a 45-60 second reel: ${lang().words[0]}-${lang().words[1]} spoken words, 12-16 beats. Prefer this. ONLY if the story or the explanation genuinely cannot land in 60 seconds, you may go long (up to 3 minutes, max 400 words, up to 40 beats); then set "length":"long" and give a one-line "length_reason". Never pad. Each beat ${lang().beatWords} words, one idea, short sentences.
- The takeaway must agree with the blog's recommendations.
- BRAND (see AiA CONTEXT): the reel's job is fun, engaging storytelling about a mundane accounting topic, not selling. Whenever the story shows a problem AiA directly solves (CONTEXT sections 2-3: typing bills by hand, messy/handwritten bills, bank statement entry, GSTR-2B matching, accountant churn/backlog, no real-time numbers, duplicate bills, choosing or switching software), you SHOULD weave AI Accountant in ONCE, inside the story, as the smart founder's move, with one concrete thing it does, describing it as working on top of Tally, never as accounting software. If the problem is a deadline, a rule or a registration, do NOT mention AiA (the CTA already does). No generic tag-on lines, no "best"/"number one", no pricing, no unlaunched features.
- Competitors and alternatives (Tally's Docs by Ira, Suvit, Zoho Books, Excel imports, generic OCR) may be named only when the story is about choosing a tool, using ONLY the facts in CONTEXT section 6, fairly and without mockery, with the contrast naturally favouring AiA. Never make specific claims about VouchrIt.
- Proof points (75%, 95% bills accuracy, 50+ banks, survey stats, 21-branch hotel) only exactly as written in CONTEXT section 4, and only when they serve the story.

VISUAL per beat (one of). Mix: stock footage for HUMAN moments (people, shops, offices, stress), animated scenes for EXPLAINING, paper for NUMBERS (stat = one big figure hand-written and circled on paper; paper_math = the working of a figure written out line by line).
- {"type":"footage","query":"2-3 word ENGLISH stock video search that LITERALLY shows what this beat's words are about (the invoice, the shop, the worried owner, the bank SMS), concrete and filmable, human and everyday, never ambiguous words (say 'invoice paper' not 'bill') (e.g. 'indian shop owner', 'worried businessman phone', 'warehouse boxes', 'woman entrepreneur laptop'), no brand names"}
- {"type":"stat","value":"the exact figure as it appears in this beat's text","label":"2-5 word plain-English label"}
- {"type":"text","value":"2-5 word punchline shown huge on screen, plain words"}
- {"type":"scene","scene":"<kind>","params":{...}} animated explainer/product scene. Kinds:
${Object.entries(SCENE_KINDS).map(([k, d]) => `  * ${k}: ${d}`).join("\n")}
  THE CANVAS (most important): the explanation of the one idea happens on ONE paper canvas (paper_math) that stays on screen for 2-3 consecutive beats (about 6-10 seconds) while the voice walks through it, like a teacher writing on paper. Each line is written at the moment the voice says it, so the order of rows must match the order they are spoken, and every row value must be said aloud in those beats exactly as written on the paper. Put the SAME paper_math object on each of those consecutive beats (it is drawn once and fills in as you speak). If the story has a worked example with amounts or dates ("let's say ₹15 lakh...", interest, a penalty, credit lost, hours saved), it MUST be on the canvas. The canvas must WORK SOMETHING OUT: each row a concrete quantity (amount, count, days, hours), and the result a concrete figure or outcome that follows from them (e.g. "300 bills x 4 min = 20 hours", "₹1,80,000 - ₹42,000 = ₹1,38,000"). Never filler rows like "Per day: every day". If the figures are a hypothetical illustration, mark that beat "kind":"example" and say "let's say" aloud. Use one canvas per reel (two only if truly needed). A single headline figure outside the canvas uses stat. Every figure on paper must appear in the spoken text (or be a clearly hypothetical "let's say" example).
  Product scenes (bills_flow, bank_match, gst_match, whatsapp) ONLY on the beat(s) where AI Accountant is mentioned. Explainer scenes (deadline, meter, split, flow) whenever a process, deadline, ticking cost or comparison is being explained. Scene params are short on-screen labels in Latin script; any figure in params must appear in that beat's text.
Visual rhythm: footage for the hook and human moments (it is cut every ~2.5 seconds automatically), the canvas for the explanation, plus 1-2 other scenes or stat/text punches. Never two text cards in a row. A scene may stay on screen for up to 3 beats (repeat the same visual object). The cta beat uses {"type":"text","value":"aiaccountant.com"}.

Also return "keywords" per beat: 0-3 words copied exactly from that beat's text to highlight in captions (numbers, the key noun).

Return ONLY JSON:
{"length":"short|long","length_reason":"only if long",
 "hook_options":["3 different hooks, strongest first"],
 "hook_text":"3-7 word on-screen headline for the first shot",
 "title":"YouTube Shorts title, max 60 chars, relatable and curiosity-driven, MUST contain the SEARCH KEYWORD (or a close variant), no clickbait lies",
 "beats":[{"role":"hook|setup|story|twist|takeaway|cta","kind":"fact|example","text":"spoken words","visual":{...},"keywords":["..."]}],
 "caption":"Post caption, max 3 short lines (under 300 characters). Line 1 is a scroll-stopping hook for readers (max 12 words: a surprising stake, a sharp question or a bold claim the reel backs up; not a copy of the spoken hook, no 'Did you know', no emoji spam). Line 2 is the one-line payoff or takeaway. Optional line 3: a short nudge to read the link in the first comment. NO URLs or links in the caption (the link goes in the first comment)",
 "hashtags":["#GST","..."] (6-10, mix broad and niche, Indian business context)}`;

const norm = (s) => s.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
/** Spoken text without v3 delivery tags. */
export const stripTags = (s) => String(s || "").replace(/\[[^\]]*\]\s*/g, "").trim();
const countWords = (s) => stripTags(s).split(/\s+/).filter(Boolean).length;

/** Every number in the script must occur in the blog. Returns list of offending tokens. */
export function unsupportedNumbers(script, blogText) {
  const blog = norm(blogText);
  const nums = new Set();
  for (const b of script.beats) {
    if (b.kind === "example") continue; // clearly-framed hypothetical amounts
    for (const src of [stripTags(b.text), b.visual?.value || "", JSON.stringify(b.visual?.params || {})]) {
      for (const m of norm(src).matchAll(/\d+(?:\.\d+)?/g)) nums.add(m[0]);
    }
  }
  for (const m of norm(script.hook_text || "").matchAll(/\d+(?:\.\d+)?/g)) nums.add(m[0]); // on-screen headline too
  return [...nums].filter((n) => !new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(blog));
}

export function validateShape(s) {
  const errs = [];
  if (!s.title || !Array.isArray(s.beats)) errs.push("missing title/beats");
  const beats = s.beats || [];
  const [lo, hi] = lang().words;
  const long = s.length === "long";
  if (beats.length < 10 || beats.length > (long ? 40 : 18)) errs.push(`beat count ${beats.length} (want ${long ? "up to 40" : "12-16"})`);
  const words = beats.reduce((n, b) => n + countWords(b.text), 0);
  const max = long ? 420 : hi + 50; // real length is enforced on measured voice duration
  if (words > max) errs.push(`Too long: ${words} spoken words. Cut about ${words - (long ? 400 : hi)} words: drop or merge beats, shorten sentences.${long ? "" : ` Or, only if the story truly needs it, mark "length":"long".`}`);
  if (words < lo - 20) errs.push(`Too short: ${words} spoken words. Add about ${lo - words} words of story. Target ${lo}-${hi}.`);
  if (beats[0]?.role !== "hook") errs.push("first beat must be hook");
  if (beats[0] && countWords(beats[0].text) > 10) errs.push("hook longer than 9 words");
  if (!s.hook_text || countWords(s.hook_text) > 8) errs.push("hook_text missing or longer than 7 words");
  for (const b of beats) if (!b.visual?.type) errs.push(`beat without visual: ${b.text}`);
  for (const b of beats) {
    const p = b.visual?.scene === "paper_math" ? b.visual.params || {} : null;
    if (p && (!Array.isArray(p.rows) || p.rows.length < 2 || !p.result?.value)) errs.push(`paper_math needs 2-4 rows of {label, value} and a result {label, value}: ${b.text}`);
  }
  // Focus: count distinct real figures outside the worked example (and the CTA). More than 2 = more than one idea.
  const facts = new Set();
  for (const b of beats) {
    if (b.kind === "example" || b.role === "cta" || b.visual?.scene === "paper_math") continue;
    for (const m of stripTags(b.text).matchAll(/\d+(?:[.,]\d+)*/g)) facts.add(m[0]);
    for (const m of stripTags(b.text).matchAll(/\b(twice|three times|double|half)\b/gi)) facts.add(m[0].toLowerCase());
  }
  if (facts.size > 2) errs.push(`Too many ideas for one reel (figures: ${[...facts].join(", ")}). Teach ONE idea: keep only the figures that idea needs and cut side rules, exceptions and extra penalties.`);
  const worked = beats.find((b) => b.kind === "example" && /₹\s?\d|\d+\s?(lakh|crore|%|days|hours)/i.test(stripTags(b.text)));
  if (worked && !beats.some((b) => b.visual?.scene === "paper_math")) errs.push(`Show the worked example on paper: give the beat "${stripTags(worked.text).slice(0, 80)}" a paper_math scene with its figures as rows and the outcome as the result.`);
  if (String(s.caption || "").length > 320) errs.push("caption too long: max 3 short lines, under 300 characters, starting with a hook line");
  if (/https?:\/\/|www\.|\.com\b/i.test(s.caption || "")) errs.push("caption must not contain any link or URL (the link goes in the first comment)");
  const onScreen = [s.title, s.caption, s.hook_text, ...beats.flatMap((b) => [b.visual?.value, b.visual?.label])].join(" ");
  if (currentLanguage === "english" && beats.some((b) => /[ऀ-ॿ]/.test(b.text))) errs.push("This is an ENGLISH reel: rewrite every beat in English only, no Hindi or Devanagari.");
  if (/[ऀ-ॿ]/.test(onScreen)) errs.push("on-screen text, title and caption must use Latin script only");
  return { errs, words };
}

export async function writeScript(blog, angle, { feedback = "", targetWords, research, previous } = {}) {
  const angleText = ANGLES[angle] || angle;
  const notes = research?.notes || [];
  const user = `ANGLE: ${angleText}
BLOG MAIN TOPIC: ${blog.title}
SEARCH KEYWORD: ${research?.keyword || blog.title}
RESEARCH NOTES (verified, newer than the blog; you may use these facts):
${notes.length ? notes.map((n) => `- ${n.fact}`).join("\n") : "- (none)"}
${targetWords ? `TARGET LENGTH: about ${targetWords} spoken words total.\n` : ""}${feedback ? (previous ? `YOUR PREVIOUS DRAFT (below) WAS REJECTED. Make the SMALLEST possible edit: rewrite or remove only the flagged lines and keep the rest of the story (if the problem is length, cut or merge beats until it fits; that is the only case where you may change other beats). Never replace a flagged claim with a new unsupported claim.\nProblems:\n${feedback}\nPREVIOUS DRAFT JSON:\n${JSON.stringify(previous)}\n` : `YOUR PREVIOUS DRAFT WAS REJECTED. Fix these problems:\n${feedback}\n`) : ""}
BLOG_URL: ${blog.url}
BLOG TITLE: ${blog.title}
BLOG POST:
"""
${blog.text}
"""`;
  const { json, cost } = await chatJSON({ model: config.scriptModel, system: `${system()}\n\nAiA CONTEXT (product, proof points, competitors; only source for claims about AI Accountant and competitors):\n${PRODUCT}`, user: user.replace("<BLOG_URL>", blog.url) });
  return { script: normalizeVisuals(json), cost };
}

/** Models sometimes write {"type":"paper_math"} instead of {"type":"scene","scene":"paper_math"}. */
function normalizeVisuals(script) {
  for (const b of script?.beats || []) {
    const v = b.visual;
    if (v && SCENE_KINDS[v.type]) b.visual = { type: "scene", scene: v.type, params: v.params || {} };
  }
  return script;
}

/** Cheap second model checks every claim against the post. */
export async function factCheck(blog, script, notes = []) {
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `You are a strict fact-checker. Compare a short video script (may be in Hinglish) with its English sources: a blog post, researched notes, and AI Accountant product facts (the only valid source for claims about AI Accountant).
Flag a claim ONLY if it states a fact, number, deadline, rule, percentage or example that is NOT supported by the blog post or the research notes, or contradicts them. Rhetorical framing, light humour, opinions, hooks phrased as questions, simplifications that keep the meaning, and bold-but-fair generalisations or approximate stakes ("most founders miss this", "can cost lakhs") that a reasonable reader of the sources would accept are fine. Flag only specific claims (rate, penalty, deadline, rule, real case, exact amount) that are wrong or unsupported for the situation described, and real meaning changes. Do NOT flag harmless storytelling details (scene-setting, feelings, approximate timing like "month end", what a founder thinks or does) unless they state a wrong rule. The CTA line is fine. Lines marked (EXAMPLE) are hypothetical illustrations: their own made-up amounts are fine IF the line is clearly framed as hypothetical (मान लो / सोचो / for example), but any rate, penalty, deadline or rule they state must still be supported.
Return ONLY JSON: {"ok": true|false, "issues": ["<quoted claim> - why unsupported"]}`,
    user: `BLOG POST:\n"""\n${blog.text}\n"""\n\nPRODUCT FACTS:\n${PRODUCT}\n\nRESEARCH NOTES:\n${notes.map((n) => `- ${n.fact}`).join("\n") || "- (none)"}\n\nSCRIPT:\n${script.beats.map((b, i) => `${i + 1}.${b.kind === "example" ? " (EXAMPLE)" : ""} ${stripTags(b.text)}${b.visual?.value ? ` [on-screen: ${b.visual.value}${b.visual.label ? " " + b.visual.label : ""}]` : ""}`).join("\n")}`,
  });
  return { ok: !!json.ok && !(json.issues || []).length, issues: json.issues || [], cost };
}

/** Text sent to TTS (keeps v3 delivery tags). */
export const scriptText = (s) => s.beats.map((b) => b.text.trim()).join(" ");
/** Human-readable script (no tags). */
export const scriptPlain = (s) => s.beats.map((b) => stripTags(b.text)).join(" ");

/**
 * Captions: transliterate transcript words to Roman Hinglish, one-to-one.
 * Returns the same array length, or null if the model breaks the mapping.
 */
export async function romanize(words) {
  if (!words.some((w) => /[ऀ-ॿ]/.test(w))) return { words, cost: 0 };
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `Transliterate each item of a JSON array from Hindi/Devanagari to casual Roman Hinglish as Indians type on Instagram (e.g. "महीने" -> "mahine", "लेकिन" -> "lekin", "है।" -> "hai."). Keep English words, numbers, ₹ and punctuation unchanged. Output EXACTLY one item per input item, same order.
Return ONLY JSON: {"words": ["..."]}`,
    user: JSON.stringify(words),
  });
  const out = json.words;
  if (!Array.isArray(out) || out.length !== words.length) return { words: null, cost };
  return { words: out.map(String), cost };
}

/** "Would a founder with zero accounting knowledge get every line?" Returns {ok, issues}. */
export async function plainCheck(script) {
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `You review a Hinglish Shorts script for founders of Indian small businesses who have ZERO accounting knowledge.
Everyday business words founders already use are FINE and must not be flagged: GST, TDS, invoice, bill, turnover, deadline, return, late fee, interest, penalty, notice, CA, Tally, software, vendor, supplier, payment, deposit, e-invoice.
Flag ONLY real problems: specialist jargon left unexplained (e.g. ITC, RCM, GSTR-2B, reverse charge, section or form numbers, legal terms); more than 2 specialist terms in total; the script reads like a list of rules instead of a story about a person; a line that is genuinely confusing.
Report at most the 3 most important problems. ok=true when there are 0 or 1 minor problems.
Return ONLY JSON: {"ok": true|false, "issues": ["<quoted line> - what is confusing and a plainer way to say it"]}`,
    user: script.beats.map((b, i) => `${i + 1}. ${stripTags(b.text)}`).join("\n"),
  });
  return { ok: !!json.ok && !(json.issues || []).length, issues: json.issues || [], cost };
}
