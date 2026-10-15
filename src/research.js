import { config } from "./config.js";
import { http } from "./util.js";

const BASE = "https://openrouter.ai/api/v1";

/**
 * Web research around the blog's topic. The blog is only a direction: we look for
 * fresh, story-worthy, verifiable facts an Indian SMB founder would care about.
 * Returns { keyword, notes: [{fact, source_url}], cost }.
 */
export async function research(blog) {
  const headers = { "Content-Type": "application/json" };
  if (config.openrouterKey) headers.Authorization = `Bearer ${config.openrouterKey}`;
  const res = await http(`${BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.researchModel,
      temperature: 0.3,
      max_tokens: 6000,
      reasoning: { effort: "low" },
      usage: { include: true },
      plugins: [{ id: "web", max_results: config.researchResults }],
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a researcher for a viral Indian business-explainer Shorts channel (audience: founders of Indian SMBs, Rs 1-100 crore turnover).
Given a blog post as a TOPIC DIRECTION, use web search ON THE BLOG'S MAIN TOPIC (its title) only; do not drift to neighbouring topics, to find 5-8 facts that help tell a RELATABLE story to founders with zero accounting knowledge: real business stories and news (a business that got a notice, cash stuck, a costly mistake), the everyday consequence of getting this wrong (money, time, stress), surprising 'why does this rule exist' facts, and the 1-2 key figures (penalty, rate, deadline) that make the stakes real. Prefer human stories and plain consequences over form numbers and section references.
Prefer official sources (gst.gov.in, incometax.gov.in, cbic.gov.in, PIB, RBI, MCA) and reputable media (Economic Times, Mint, Business Standard, Moneycontrol). Only include a fact if a search result you actually saw states it. Copy numbers exactly. Today's date: ${new Date().toISOString().slice(0, 10)}; prefer the latest rules.
Put a fact in "notes" only if it is clear and current. If sources disagree with each other or with the blog post (e.g. an old rate or deadline in the blog), do NOT put it in notes; describe it in "conflicts" instead so a human can check the blog.
Also give the post's primary search keyword (what people type into Google to find THIS post, close to its title).
Return ONLY JSON: {"keyword":"...","notes":[{"fact":"one sentence with the exact figure","source_url":"https://..."}],"conflicts":["blog says X, source Y says Z (url)"]}`,
        },
        { role: "user", content: `BLOG TITLE: ${blog.title}\nBLOG URL: ${blog.url}\nBLOG EXCERPT:\n"""\n${blog.text.slice(0, 6000)}\n"""` },
      ],
    }),
  }, 240_000);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  let json = {};
  try { json = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1)); } catch {}
  // Keep only notes whose source the search actually returned (guards against made-up citations).
  const cited = new Set((data.choices?.[0]?.message?.annotations || []).map((a) => a.url_citation?.url).filter(Boolean));
  const notes = (json.notes || []).filter((n) => n.fact && /^https?:\/\//.test(n.source_url || ""))
    .filter((n) => !cited.size || [...cited].some((u) => sameDoc(u, n.source_url)));
  // Guard against topic drift: the keyword must share a meaningful word with the blog title.
  const words = (x) => new Set(String(x).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const titleWords = words(blog.title);
  const onTopic = [...words(json.keyword)].some((w) => titleWords.has(w) && !["the", "and", "for", "india", "your"].includes(w));
  return { keyword: onTopic ? json.keyword : blog.title, notes, conflicts: json.conflicts || [], cost: data.usage?.cost ?? 0 };
}

const sameDoc = (a, b) => {
  const k = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
  return k(a) === k(b);
};

/** Text block of all allowed facts: the blog itself + researched notes. */
export const sourcesText = (blog, notes) =>
  `${blog.text}\n\n${notes.map((n) => `${n.fact} (source: ${n.source_url})`).join("\n")}`;
