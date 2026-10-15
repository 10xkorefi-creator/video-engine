import * as cheerio from "cheerio";
import { http } from "./util.js";

/** Fetch a Webflow blog post and return { url, title, text }. */
export async function fetchBlog(url) {
  const html = await (await http(url, { headers: { "User-Agent": "Mozilla/5.0 reel-engine" } })).text();
  const $ = cheerio.load(html);
  const title = ($("h1").first().text() || $('meta[property="og:title"]').attr("content") || $("title").text()).trim();

  // Webflow rich text: prefer the main article block, else the largest rich-text block.
  let body = $(".blog-text.w-richtext").first();
  if (!body.length) {
    let best = null;
    $(".w-richtext, article").each((_, el) => {
      if (!best || $(el).text().length > $(best).text().length) best = el;
    });
    body = $(best);
  }
  if (!body.length) throw new Error("no article body found");

  body.find("script, style, figure, img, iframe, form, .w-embed").remove();
  const parts = [];
  body.find("h2, h3, h4, p, li, td, th, blockquote").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    const tag = el.tagName.toLowerCase();
    parts.push(tag.startsWith("h") ? `\n## ${t}` : tag === "li" ? `- ${t}` : t);
  });
  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 800) throw new Error(`article text too short (${text.length} chars)`);
  // Keep the prompt bounded (~6k tokens).
  return { url, title, text: text.slice(0, 24_000) };
}
