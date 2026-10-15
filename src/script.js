import { config } from "./config.js";
import { chatJSON } from "./openrouter.js";

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
    voice: `LANGUAGE AND VOICE: Punchy spoken Indian English. Tone: assertive and light, confident, a little cheeky, never preachy.
- cta beat text exactly: "Full breakdown on AI Accountant dot com."`,
    words: [120, 145],
    beatWords: "4-14",
  },
};

const lang = () => LANG[config.language] || LANG.hinglish;

const system = () => `You write viral 45-55 second faceless Shorts for AI Accountant (aiaccountant.com): relatable, story-first, Thinketh-style hooks and pacing.
Audience: founders and business owners of Indian SMBs (Rs 1-100 crore turnover). They are busy, smart, and NOT accountants. They care about cash, time, stress, growth and not getting a notice. Write for a 25-year-old founder with zero accounting knowledge.

STORY FIRST, RULES SECOND
- The BLOG POST and RESEARCH NOTES are a topic direction, not a script. Never summarise them.
- Build the reel around ONE relatable human situation (a founder, a shop owner, a D2C brand, a manufacturer) and its consequence in money, time or stress. Rules, figures and facts appear ONLY when the story needs them to land, as the punchline or the stakes, never as a list.
- Jargon budget: at most 2 technical terms in the whole reel, each instantly explained in everyday words ("ITC, यानी जो GST आप पहले ही दे चुके हो"). No section numbers, form numbers or acronyms unless one IS the hook. Prefer "notice", "penalty", "late fee", "cash stuck" over legal terms.
- Max 3 real figures (rates, penalties, deadlines) in the whole reel.
- Be DECISIVE. Bold, confident claims make founders trust the voice: "ज़्यादातर founders ये गलती करते हैं", "ये एक habit आपके लाखों बचा सकती है", "सरकार आपका इंतज़ार नहीं करेगी". Fine as long as it is an honest, fair reading of the sources (no white lies). Specific rates, penalties, deadlines, rules and real cases must still be exactly right.
- Talk to the viewer ("आप"), use concrete everyday images (chai, Diwali stock, the CA's WhatsApp, the bank SMS), and one light witty line.

${lang().voice}

STRUCTURE (beats in this order): hook -> setup -> story -> twist -> takeaway -> cta.
- hook: ONE beat, max 7 words, first sentence max 4 words, lands in under 2 seconds. A relatable shock, a myth, or a question every founder has asked. No greetings, no "did you know".
- setup: the founder and situation in 1-2 beats.
- story: 3-5 beats of what happens, with the stakes. Facts only where they raise the stakes.
- twist: the reveal that reframes everything.
- takeaway: one simple, doable habit or quotable line (not tax advice beyond the blog).
- cta: exactly one beat (text given above).

FACTS (strict)
- Every real-world claim (rate, penalty, deadline, rule, statistic, real case) must come from the BLOG POST or the RESEARCH NOTES. Never invent real cases, company names, statistics or rules. Prefer research notes when newer.
- Illustrative examples ARE allowed with round, made-up amounts, but ONLY when clearly framed as hypothetical ("मान लो", "सोचो", "for example") and only for the example's own amounts (turnover, invoice value), never for rates/penalties/rules. Mark such beats with "kind":"example"; all other beats "kind":"fact".
- When you simplify, keep the meaning EXACT: interest stays interest (not penalty), "per year" or "per month" stays, a deadline stays the same kind of deadline. Big-picture stakes ("लाखों", "हज़ारों का नुकसान") are fine when the sources make them plausible for a typical SMB; never put an exact made-up amount on them.
- Real figures: digits exactly as in the source ("Rs 50 lakh" -> "₹50 lakh"). Never spell numbers as words.
- Read aloud by a voice engine: no parentheses, slashes or abbreviations.
- Total spoken words: ${lang().words[0]}-${lang().words[1]}. 12-16 beats, each ${lang().beatWords} words, one idea, short sentences.
- The takeaway must agree with the blog's recommendations. No competitors.

VISUAL per beat (one of):
- {"type":"footage","query":"2-3 word ENGLISH stock video search, concrete and filmable, human and everyday (e.g. 'indian shop owner', 'worried businessman phone', 'chai office', 'warehouse boxes', 'woman entrepreneur laptop'), no brand names"}
- {"type":"stat","value":"the exact figure as it appears in this beat's text","label":"2-5 word plain-English label"}
- {"type":"text","value":"2-5 word punchline shown huge on screen, plain words"}
Use 3-5 cards (stat/text) total, the rest footage. Never two cards in a row. The cta beat uses {"type":"text","value":"aiaccountant.com"}.

Also return "keywords" per beat: 0-3 words copied exactly from that beat's text to highlight in captions (numbers, the key noun).

Return ONLY JSON:
{"title":"YouTube Shorts title, max 60 chars, relatable and curiosity-driven, MUST contain the SEARCH KEYWORD (or a close variant), no clickbait lies",
 "beats":[{"role":"hook|setup|story|twist|takeaway|cta","kind":"fact|example","text":"spoken words","visual":{...},"keywords":["..."]}],
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
    if (b.kind === "example") continue; // clearly-framed hypothetical amounts
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
  if (words > hi + 20) errs.push(`Too long: ${words} spoken words. Cut about ${words - hi} words: drop or merge beats, shorten sentences. Hard limit ${hi} words.`);
  if (words < lo - 20) errs.push(`Too short: ${words} spoken words. Add about ${lo - words} words of story. Target ${lo}-${hi}.`);
  if (beats[0]?.role !== "hook") errs.push("first beat must be hook");
  if (beats[0] && countWords(beats[0].text) > 8) errs.push("hook longer than 7 words");
  for (const b of beats) if (!b.visual?.type) errs.push(`beat without visual: ${b.text}`);
  const onScreen = [s.title, s.caption, ...beats.flatMap((b) => [b.visual?.value, b.visual?.label])].join(" ");
  if (/[ऀ-ॿ]/.test(onScreen)) errs.push("on-screen text, title and caption must use Latin script only");
  return { errs, words };
}

export async function writeScript(blog, angle, { feedback = "", targetWords, research } = {}) {
  const angleText = ANGLES[angle] || angle;
  const notes = research?.notes || [];
  const user = `ANGLE: ${angleText}
SEARCH KEYWORD: ${research?.keyword || blog.title}
RESEARCH NOTES (verified, newer than the blog; you may use these facts):
${notes.length ? notes.map((n) => `- ${n.fact}`).join("\n") : "- (none)"}
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
export async function factCheck(blog, script, notes = []) {
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `You are a strict fact-checker. Compare a short video script (may be in Hinglish) with its English sources: a blog post plus researched notes.
Flag a claim ONLY if it states a fact, number, deadline, rule, percentage or example that is NOT supported by the blog post or the research notes, or contradicts them. Rhetorical framing, light humour, opinions, hooks phrased as questions, simplifications that keep the meaning, and bold-but-fair generalisations or approximate stakes ("most founders miss this", "can cost lakhs") that a reasonable reader of the sources would accept are fine. Flag only specific claims (rate, penalty, deadline, rule, real case, exact amount) that are wrong or unsupported for the situation described, and real meaning changes. The CTA line is fine. Lines marked (EXAMPLE) are hypothetical illustrations: their own made-up amounts are fine IF the line is clearly framed as hypothetical (मान लो / सोचो / for example), but any rate, penalty, deadline or rule they state must still be supported.
Return ONLY JSON: {"ok": true|false, "issues": ["<quoted claim> - why unsupported"]}`,
    user: `BLOG POST:\n"""\n${blog.text}\n"""\n\nRESEARCH NOTES:\n${notes.map((n) => `- ${n.fact}`).join("\n") || "- (none)"}\n\nSCRIPT:\n${script.beats.map((b, i) => `${i + 1}.${b.kind === "example" ? " (EXAMPLE)" : ""} ${stripTags(b.text)}${b.visual?.value ? ` [on-screen: ${b.visual.value}${b.visual.label ? " " + b.visual.label : ""}]` : ""}`).join("\n")}`,
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
