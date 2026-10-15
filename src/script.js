import { config } from "./config.js";
import { chatJSON } from "./openrouter.js";

export const ANGLES = {
  A: "THE COSTLY MISTAKE. Open on the most painful rupee figure, penalty, deadline or surprising fact in the post. Tell it as a story of what goes wrong for a typical founder, why nobody notices, and what the fix is.",
  B: "THE CONTRARIAN TAKE. Open by challenging a common belief or habit founders have about this topic, where the post itself shows the belief is wrong or costly. Investigate why, reveal the twist, and land on what smart founders do instead. The twist and moral must AGREE with the post's own advice and recommendations; never argue against what the post recommends. If the post has no such belief to challenge, use the hidden-cost angle: what founders lose by ignoring this topic.",
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
    voice: `LANGUAGE AND VOICE: Punchy spoken Indian English. Tone: assertive and light, confident, a little cheeky, never preachy.
- cta beat text exactly: "Full breakdown on AI Accountant dot com."`,
    words: [120, 145],
    beatWords: "4-14",
  },
};

const lang = () => LANG[config.language] || LANG.hinglish;

const system = () => `You write viral 45-55 second faceless explainer Shorts for AI Accountant (aiaccountant.com), inspired by Thinketh-style storytelling: hooky, story-driven, fast.
Audience: founders of Indian SMBs (Rs 1 crore to Rs 100 crore turnover). NOT accountants: no jargon without a 3-word explanation.

${lang().voice}

STRUCTURE (beats in this order): hook -> background -> investigation -> twist -> moral -> cta.
- hook: ONE beat, max 7 words, first sentence max 4 words so it lands in under 2 seconds. A shocking rupee figure, a surprising fact, or a contrarian claim. No greetings, no "did you know".
- background: set up the situation in plain words.
- investigation: 2-4 beats digging into why it happens, with the concrete facts/figures from the post.
- twist: the reveal that reframes everything.
- moral: one short quotable line.
- cta: exactly one beat (text given above).

HARD RULES
- Use ONLY facts, numbers, deadlines, sections and percentages that appear in the BLOG POST. Never invent figures, case studies, company names, cities or statistics. If the post has no rupee figure, hook with a surprising fact or contrarian claim from it instead.
- Write every number in digits exactly as the post does (e.g. "Rs 50 lakh" -> "₹50 lakh", "18%" -> "18%"). Never convert or round numbers. Do not spell numbers as words.
- Everything is read aloud by a voice engine: no parentheses, slashes or abbreviations it could misread. Write "Section 50(3)" as "Section 50, sub-section 3", "u/s" as "under section".
- Total spoken words across all beats: ${lang().words[0]}-${lang().words[1]}. 12-16 beats. Each beat ${lang().beatWords} words, one idea. Short sentences.
- The twist and the moral must agree with the post's conclusions and recommendations.
- Do not mention competitors. Do not give tax advice beyond what the post says.

VISUAL per beat (one of):
- {"type":"footage","query":"2-3 word ENGLISH stock video search, concrete and filmable, generic (e.g. 'calculator desk', 'warehouse boxes', 'busy indian market', 'laptop spreadsheet', 'stressed businessman'), no brand names"}
- {"type":"stat","value":"the exact figure as it appears in this beat's text, e.g. '₹50 lakh' or '18%' or '20th'","label":"2-5 word label"}
- {"type":"text","value":"2-5 word punchline shown huge on screen"}
Use stat for every beat whose key point is a number. Use 4-6 cards (stat/text) total, the rest footage. Never two cards in a row. The cta beat uses {"type":"text","value":"aiaccountant.com"}.

Also return "keywords" per beat: 0-3 words copied exactly from that beat's text to highlight in captions (numbers, the key noun).

Return ONLY JSON:
{"title":"YouTube Shorts title, max 60 chars, curiosity-driven, no clickbait lies",
 "beats":[{"role":"hook|background|investigation|twist|moral|cta","text":"spoken words","visual":{...},"keywords":["..."]}],
 "caption":"Instagram/LinkedIn description, 2-3 short lines, ends with 'Read the full guide: <BLOG_URL>'",
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
    for (const src of [stripTags(b.text), b.visual?.value || ""]) {
      for (const m of norm(src).matchAll(/\d+(?:\.\d+)?/g)) nums.add(m[0]);
    }
  }
  return [...nums].filter((n) => !new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(blog));
}

export function validateShape(s) {
  const errs = [];
  if (!s.title || !Array.isArray(s.beats)) errs.push("missing title/beats");
  const beats = s.beats || [];
  const [lo, hi] = lang().words;
  if (beats.length < 10 || beats.length > 18) errs.push(`beat count ${beats.length} (want 12-16)`);
  const words = beats.reduce((n, b) => n + countWords(b.text), 0);
  if (words < lo - 15 || words > hi + 15) errs.push(`total words ${words} (want ${lo}-${hi})`);
  if (beats[0]?.role !== "hook") errs.push("first beat must be hook");
  if (beats[0] && countWords(beats[0].text) > 8) errs.push("hook longer than 7 words");
  for (const b of beats) if (!b.visual?.type) errs.push(`beat without visual: ${b.text}`);
  const onScreen = [s.title, s.caption, ...beats.flatMap((b) => [b.visual?.value, b.visual?.label])].join(" ");
  if (/[ऀ-ॿ]/.test(onScreen)) errs.push("on-screen text, title and caption must use Latin script only");
  return { errs, words };
}

export async function writeScript(blog, angle, { feedback = "", targetWords } = {}) {
  const angleText = ANGLES[angle] || angle;
  const user = `ANGLE: ${angleText}
${targetWords ? `TARGET LENGTH: about ${targetWords} spoken words total.\n` : ""}${feedback ? `YOUR PREVIOUS DRAFT WAS REJECTED. Fix these problems:\n${feedback}\n` : ""}
BLOG_URL: ${blog.url}
BLOG TITLE: ${blog.title}
BLOG POST:
"""
${blog.text}
"""`;
  const { json, cost } = await chatJSON({ model: config.scriptModel, system: system().replace("<BLOG_URL>", blog.url), user });
  return { script: json, cost };
}

/** Cheap second model checks every claim against the post. */
export async function factCheck(blog, script) {
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `You are a strict fact-checker. Compare a short video script (may be in Hinglish) with its English source blog post.
Flag a claim ONLY if it states a fact, number, deadline, rule, percentage or example that is NOT supported by the blog post, or contradicts it. Rhetorical framing, light humour, opinions, hooks phrased as questions, and simplifications that keep the meaning are fine. The CTA line is fine.
Return ONLY JSON: {"ok": true|false, "issues": ["<quoted claim> - why unsupported"]}`,
    user: `BLOG POST:\n"""\n${blog.text}\n"""\n\nSCRIPT:\n${script.beats.map((b, i) => `${i + 1}. ${stripTags(b.text)}${b.visual?.value ? ` [on-screen: ${b.visual.value}${b.visual.label ? " " + b.visual.label : ""}]` : ""}`).join("\n")}`,
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
