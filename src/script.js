import { config } from "./config.js";
import { chatJSON } from "./openrouter.js";

export const ANGLES = {
  A: "THE COSTLY MISTAKE. Open on the most painful rupee figure, penalty, deadline or surprising fact in the post. Tell it as a story of what goes wrong for a typical founder, why nobody notices, and what the fix is.",
  B: "THE CONTRARIAN TAKE. Open by challenging a common belief or habit founders have about this topic, where the post itself shows the belief is wrong or costly. Investigate why, reveal the twist, and land on what smart founders do instead. The twist and moral must AGREE with the post's own advice and recommendations; never argue against what the post recommends. If the post has no such belief to challenge, use the hidden-cost angle: what founders lose by ignoring this topic.",
};

const SYSTEM = `You write viral 45-55 second faceless explainer Shorts for AI Accountant (aiaccountant.com), in the style of the YouTube channel Thinketh: confident, dramatic, story-driven, fast.
Audience: founders of Indian SMBs (Rs 1 crore to Rs 100 crore turnover). NOT accountants: no jargon without a 3-word explanation.

STRUCTURE (beats in this order): hook -> background -> investigation -> twist -> moral -> cta.
- hook: ONE beat, max 7 words, first sentence max 4 words so it lands in under 2 seconds. A shocking rupee figure, a surprising fact, or a contrarian claim. No greetings, no "did you know".
- background: set up the situation in plain words.
- investigation: 2-4 beats digging into why it happens, with the concrete facts/figures from the post.
- twist: the reveal that reframes everything. Start it with a turn like "But here's the catch" or "Here's what nobody tells you".
- moral: one short quotable line.
- cta: exactly one beat: "Full breakdown on AI Accountant dot com."

HARD RULES
- Use ONLY facts, numbers, deadlines, sections and percentages that appear in the BLOG POST. Never invent figures, case studies, company names, cities or statistics. If the post has no rupee figure, hook with a surprising fact or contrarian claim from it instead.
- Write every number in digits exactly as the post does (e.g. "Rs 50 lakh" -> write "₹50 lakh", "18%" -> "18%", "20th" -> "20th"). Never convert or round numbers.
- Everything is read aloud by a voice engine: no parentheses, slashes or abbreviations it could misread. Write "Section 50(3)" as "Section 50, sub-section 3", "u/s" as "under section", "FY 2025-26" as "financial year 2025-26".
- Total spoken words across all beats: 125-145. 12-16 beats. Each beat 4-14 words, one idea, punchy spoken English (Indian English spelling). Short sentences. Contractions OK.
- The twist and the moral must agree with the post's conclusions and recommendations.
- Do not mention competitors. Do not give tax advice beyond what the post says.

VISUAL per beat (one of):
- {"type":"footage","query":"2-3 word stock video search, concrete and filmable, generic (e.g. 'calculator desk', 'warehouse boxes', 'busy indian market', 'laptop spreadsheet', 'stressed businessman'), no brand names, no text-in-image ideas"}
- {"type":"stat","value":"the exact figure as it appears in this beat's text, e.g. '₹50 lakh' or '18%' or '20th'","label":"2-5 word label"}
- {"type":"text","value":"2-5 word punchline shown huge on screen"}
Use stat for every beat whose key point is a number. Use 4-6 cards (stat/text) total, the rest footage. Never two cards in a row. The cta beat uses {"type":"text","value":"aiaccountant.com"}.

Also return "keywords" per beat: 0-3 words from that beat to highlight in captions (numbers, the key noun).

Return ONLY JSON:
{"title":"YouTube Shorts title, max 60 chars, curiosity-driven, no clickbait lies",
 "beats":[{"role":"hook|background|investigation|twist|moral|cta","text":"spoken words","visual":{...},"keywords":["..."]}],
 "caption":"Instagram/LinkedIn description, 2-3 short lines, ends with 'Read the full guide: <BLOG_URL>'",
 "hashtags":["#GST","..."] (6-10, mix broad and niche, Indian business context)}`;

const norm = (s) => s.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");

/** Every number in the script must occur in the blog. Returns list of offending tokens. */
export function unsupportedNumbers(script, blogText) {
  const blog = norm(blogText);
  const nums = new Set();
  for (const b of script.beats) {
    for (const src of [b.text, b.visual?.value || ""]) {
      for (const m of norm(src).matchAll(/\d+(?:\.\d+)?/g)) nums.add(m[0]);
    }
  }
  return [...nums].filter((n) => !new RegExp(`(^|[^\\d.])${n.replace(".", "\\.")}([^\\d]|$)`).test(blog));
}

export function validateShape(s) {
  const errs = [];
  if (!s.title || !Array.isArray(s.beats)) errs.push("missing title/beats");
  const beats = s.beats || [];
  if (beats.length < 10 || beats.length > 18) errs.push(`beat count ${beats.length} (want 12-16)`);
  const words = beats.reduce((n, b) => n + String(b.text || "").split(/\s+/).filter(Boolean).length, 0);
  if (words < 110 || words > 160) errs.push(`total words ${words} (want 125-145)`);
  if (beats[0]?.role !== "hook") errs.push("first beat must be hook");
  if (beats[0] && beats[0].text.split(/\s+/).length > 8) errs.push("hook longer than 7 words");
  for (const b of beats) if (!b.visual?.type) errs.push(`beat without visual: ${b.text}`);
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
  const { json, cost } = await chatJSON({ model: config.scriptModel, system: SYSTEM.replace("<BLOG_URL>", blog.url), user });
  return { script: json, cost };
}

/** Cheap second model checks every claim against the post. */
export async function factCheck(blog, script) {
  const { json, cost } = await chatJSON({
    model: config.checkModel,
    temperature: 0,
    system: `You are a strict fact-checker. Compare a short video script with its source blog post.
Flag a claim ONLY if it states a fact, number, deadline, rule, percentage or example that is NOT supported by the blog post, or contradicts it. Rhetorical framing, opinions, hooks phrased as questions, and simplifications that keep the meaning are fine. The CTA line is fine.
Return ONLY JSON: {"ok": true|false, "issues": ["<quoted claim> - why unsupported"]}`,
    user: `BLOG POST:\n"""\n${blog.text}\n"""\n\nSCRIPT:\n${script.beats.map((b, i) => `${i + 1}. ${b.text}${b.visual?.value ? ` [on-screen: ${b.visual.value}${b.visual.label ? " " + b.visual.label : ""}]` : ""}`).join("\n")}`,
  });
  return { ok: !!json.ok && !(json.issues || []).length, issues: json.issues || [], cost };
}

export const scriptText = (s) => s.beats.map((b) => b.text.trim()).join(" ");
