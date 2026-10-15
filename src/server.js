import http from "node:http";
import { config } from "./config.js";
import { makeReel } from "./pipeline.js";
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

    if (req.method === "POST" && req.url === "/reels") {
      if (config.serviceToken && req.headers.authorization !== `Bearer ${config.serviceToken}`) {
        return send(res, 401, { ok: false, error: "unauthorized" });
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      let body;
      try { body = JSON.parse(raw || "{}"); } catch { return send(res, 400, { ok: false, error: "invalid JSON" }); }
      if (!/^https?:\/\//.test(body.blog_url || "")) return send(res, 400, { ok: false, error: "blog_url required" });

      log(`request: ${body.blog_url} angle=${body.angle || "A"} (queue ${queued})`);
      const result = await enqueue(() =>
        makeReel({ blogUrl: body.blog_url, angle: body.angle || "A", voice: body.voice, upload: body.upload !== false }));
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
