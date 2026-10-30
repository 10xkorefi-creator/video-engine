import http from "node:http";
import { config } from "./config.js";
import { makeReel } from "./pipeline.js";
import { loadTopics, nextTopics } from "./topics.js";
import { topBlogs, usedSources } from "./storage.js";
import { nextBlogJobs } from "./blogplan.js";
import { log } from "./util.js";

// One render at a time: renders saturate the CPU, so concurrent requests queue.
let chain = Promise.resolve();
let queued = 0;
const enqueue = (fn) => {
  queued++;
  const p = chain.then(fn).finally(() => queued--);
  chain = p.catch(() => {});
  return p;
};

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, queued });

    const authed = !config.serviceToken || req.headers.authorization === `Bearer ${config.serviceToken}`;

    // Today's plan: the best-performing top blogs without a reel yet (source=topics: the old topic bank).
    if (req.method === "GET" && req.url.startsWith("/plan")) {
      if (!authed) return send(res, 401, { ok: false, error: "unauthorized" });
      const q = new URL(req.url, "http://x").searchParams;
      const languages = (q.get("languages") || "english").split(",");
      if (q.get("source") !== "topics") {
        const { jobs, blogs } = await nextBlogJobs(languages.length);
        return send(res, 200, { ok: true, source: "top_blogs", blogs, jobs: jobs.map((j, i) => ({ ...j, language: languages[i].trim() })) });
      }
      const used = await usedSources();
      const usedIds = new Set([...used].filter((u) => u.startsWith("topic:")).map((u) => u.slice(6)));
      const picks = nextTopics(usedIds, languages.length);
      const ANGLE = { "founder mistake story": "A", "myth vs reality": "B", "why behind the rule": "C", "smart founders vs others": "D" };
      const jobs = picks.map((t, i) => ({
        topic_id: t.id, title: t.title, language: languages[i].trim(),
        angle: ANGLE[(t.suggested_angles || [])[0]] || "ABCD"[i % 4], aia_fit: t.aia_fit, related_blog: t.related_blog,
      }));
      return send(res, 200, { ok: true, jobs, remaining: loadTopics().topics.length - usedIds.size - jobs.length });
    }

    if (req.method === "POST" && req.url === "/reels") {
      if (!authed) return send(res, 401, { ok: false, error: "unauthorized" });
      let raw = "";
      for await (const chunk of req) raw += chunk;
      let body;
      try { body = JSON.parse(raw || "{}"); } catch { return send(res, 400, { ok: false, error: "invalid JSON" }); }
      const blogRow = body.blog_id != null ? (await topBlogs({ id: body.blog_id }))[0] : null;
      if (body.blog_id != null && !blogRow) return send(res, 400, { ok: false, error: `unknown blog_id ${body.blog_id}` });
      const topic = !blogRow && body.topic_id ? loadTopics().topics.find((t) => t.id === body.topic_id) : null;
      if (!blogRow && body.topic_id && !topic) return send(res, 400, { ok: false, error: `unknown topic_id ${body.topic_id}` });
      if (!blogRow && !topic && !/^https?:\/\//.test(body.blog_url || "")) return send(res, 400, { ok: false, error: "blog_id, topic_id or blog_url required" });

      log(`request: ${blogRow ? "blog " + blogRow.slug : topic ? "topic " + topic.id : body.blog_url} angle=${body.angle || "A"} lang=${body.language || "default"} (queue ${queued})`);
      const result = await enqueue(() =>
        makeReel({ blogUrl: body.blog_url, blogRow, topic, angle: body.angle || "A", voice: body.voice, language: body.language, upload: body.upload !== false }));
      return send(res, result.ok ? 200 : 500, result);
    }
    send(res, 404, { ok: false, error: "not found" });
  } catch (e) {
    send(res, 500, { ok: false, failed_step: "server", error: e.message });
  }
});

// Renders take minutes: keep the HTTP connection open long enough.
server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 30 * 60_000;
server.listen(config.port, () => log(`reel-engine listening on :${config.port}`));
