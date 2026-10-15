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
Given a blog post as a TOPIC DIRECTION, use web search to find 5-8 surprising, concrete, verifiable facts that would make a gripping 50-second story for founders: recent rule changes, real penalties/amounts, deadlines, official statistics, notable real cases reported in reputable media, common costly mistakes.
Prefer official sources (gst.gov.in, incometax.gov.in, cbic.gov.in, PIB, RBI, MCA) and reputable media (Economic Times, Mint, Business Standard, Moneycontrol). Only include a fact if a search result you actually saw states it. Copy numbers exactly. Today's date: ${new Date().toISOString().slice(0, 10)}; prefer the latest rules.
Put a fact in "notes" only if it is clear and current. If sources disagree with each other or with the blog post (e.g. an old rate or deadline in the blog), do NOT put it in notes; describe it in "conflicts" instead so a human can check the blog.
Also give the post's primary search keyword (what people type into Google to find it).
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
  return { keyword: json.keyword || blog.title, notes, conflicts: json.conflicts || [], cost: data.usage?.cost ?? 0 };
}

const sameDoc = (a, b) => {
  const k = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
  return k(a) === k(b);
};

/** Text block of all allowed facts: the blog itself + researched notes. */
export const sourcesText = (blog, notes) =>
  `${blog.text}\n\n${notes.map((n) => `${n.fact} (source: ${n.source_url})`).join("\n")}`;
