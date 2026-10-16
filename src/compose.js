import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./config.js";
import { escapeHtml as esc } from "./util.js";
import { sceneHtml, SCENE_CSS, SCENE_JS, isProductScene } from "./scenes.js";

const W = 1080;
const H = 1920;
const f = (n) => Number(n).toFixed(3);

const TRANSITIONS = ["whip", "punch", "whipUp", "punch", "flash"];

/** Largest font size (px) at which `text` fits `width` on one line (approx. glyph width ratio). */
const fitSize = (text, max, width, ratio) => Math.floor(Math.min(max, width / (Math.max(1, String(text).length) * ratio)));
/** Text cards wrap: size so the longest word fits and it stays within ~4 lines. */
const fitWords = (text) => {
  const longest = Math.max(...String(text).split(/\s+/).map((w) => w.length), 1);
  return Math.min(128, fitSize("x".repeat(longest), 128, 900, 0.62), Math.floor(128 * Math.sqrt(22 / Math.max(22, String(text).length))));
};

function shotHtml(s, i) {
  const common = `class="clip shot" id="shot${i}" data-start="${f(s.start)}" data-duration="${f(s.end - s.start)}" style="z-index:${10 + i}"`;
  const v = s.visual || {};
  const type = v.type === "footage" && s.asset?.kind === "none" ? "fallback" : v.type;

  if (type === "footage" && s.asset.kind === "video") {
    return `<div ${common}><div class="kb"><video src="${s.asset.file}" muted playsinline data-start="${f(s.start)}" data-duration="${f(s.end - s.start)}"></video></div><div class="shade"></div></div>`;
  }
  if (type === "footage" && s.asset.kind === "image") {
    return `<div ${common}><div class="kb"><img src="${s.asset.file}" alt=""></div><div class="shade"></div></div>`;
  }
  if (type === "scene") {
    return `<div ${common}>${sceneHtml(v, { brand: /AI\s*Accountant|AiA/i.test(s.beatText || "") })}</div>`;
  }
  if (s.role === "cta") {
    return `<div ${common}><div class="card cta"><img class="logo" src="assets/ai-accountant-a-star-white.svg" alt=""><div class="cta-kicker">Full breakdown</div><div class="cta-url">aiaccountant.com</div><div class="cta-sub">Free guide on the blog</div></div></div>`;
  }
  if (type === "stat") {
    return `<div ${common}><div class="card stat"><div class="glow"></div><div class="stat-val" style="font-size:${fitSize(v.value, 230, 900, 0.6)}px" data-count="${esc(v.value || "")}">${esc(v.value || "")}</div><div class="stat-label">${esc(v.label || "")}</div></div></div>`;
  }
  // text card (also the fallback when no footage was found)
  const txt = type === "fallback" ? s.beatText : v.value || s.beatText;
  return `<div ${common}><div class="card text ${i % 2 ? "alt" : ""}"><div class="card-text" style="font-size:${fitWords(txt)}px">${esc(txt)}</div></div></div>`;
}

function captionHtml(c, i) {
  const words = c.words
    .map((w, j) => `<span class="w${w.hot ? " hot" : ""}${w.text.length > 11 ? " long" : ""}" id="c${i}w${j}">${esc(w.text)}</span>`)
    .join(" ");
  return `<div class="clip cap" id="cap${i}" data-start="${f(c.start)}" data-duration="${f(c.end - c.start)}"><div class="cap-line">${words}</div></div>`;
}

function audioHtml(tl, { bed }) {
  const a = [];
  tl.voice.forEach((v, i) =>
    a.push(`<audio id="voice${i}" src="voice.mp3" data-start="${f(v.start)}" data-media-start="${f(v.mediaStart)}" data-duration="${f(v.duration)}" data-volume="1"></audio>`));
  a.push(`<audio id="music" src="assets/audio/${bed}.mp3" data-start="0" data-duration="${f(tl.total)}" data-volume="0.16" data-fade-in="0.4" data-fade-out="1.2"></audio>`);
  tl.shots.forEach((s, i) => {
    if (i === 0) return;
    const sfx = s.visual?.type === "stat" ? ["impact", 0.55, 1.0] : ["whoosh", 0.32, 0.45];
    const st = Math.max(0, s.start - (sfx[0] === "whoosh" ? 0.18 : 0.02));
    a.push(`<audio id="sfx${i}" src="assets/audio/${sfx[0]}.mp3" data-start="${f(st)}" data-duration="${sfx[2]}" data-volume="${sfx[1]}"></audio>`);
  });
  if (tl.twistAt) {
    a.push(`<audio id="riser" src="assets/audio/riser.mp3" data-start="${f(Math.max(0, tl.twistAt - 1.6))}" data-duration="1.6" data-volume="0.4"></audio>`);
    a.push(`<audio id="hit" src="assets/audio/impact.mp3" data-start="${f(tl.twistAt)}" data-duration="1.0" data-volume="0.5"></audio>`);
  }
  return a.join("\n      ");
}

function timelineJs(tl) {
  const shots = tl.shots.map((s, i) => ({
    id: `shot${i}`, start: s.start, end: s.end, type: s.visual?.type, kind: s.asset?.kind, role: s.role, scene: s.visual?.scene,
    brand: s.visual?.type !== "footage" && !(s.visual?.type === "scene" && isProductScene(s.visual?.scene)) && s.role !== "cta",
    tr: i === 0 ? "none" : TRANSITIONS[i % TRANSITIONS.length],
  }));
  const caps = tl.captions.map((c, i) => ({ id: `cap${i}`, words: c.words.map((w, j) => ({ id: `c${i}w${j}`, s: w.start, e: w.end })) }));
  return `
      const DATA = ${JSON.stringify({ shots, caps, total: tl.total, twistAt: tl.twistAt })};
      const tl = gsap.timeline({ paused: true });
      const fmtIN = (n) => Math.round(n).toLocaleString("en-IN");
      // Animated count-up for a single figure (ranges like "10 to 15" stay static).
      function countUp(tl, v, t, d) {
        if (!v) return;
        const m = (v.dataset.count || "").match(/^(\\D*?)([\\d,]+(?:\\.\\d+)?)(\\D*)$/);
        if (!m) return;
        const target = parseFloat(m[2].replace(/,/g, ""));
        const dec = (m[2].split(".")[1] || "").length;
        const o = { n: 0 };
        tl.to(o, { n: target, duration: d, ease: "power2.out",
          onUpdate: () => { v.textContent = m[1] + (dec ? o.n.toFixed(dec) : (m[2].includes(",") ? fmtIN(o.n) : Math.round(o.n))) + m[3]; } }, t);
        tl.set(v, { textContent: v.dataset.count }, t + d + 0.06);
      }
${SCENE_JS}

      tl.fromTo("#progress", { scaleX: 0 }, { scaleX: 1, duration: DATA.total, ease: "none" }, 0);

      DATA.shots.forEach((s, i) => {
        const el = "#" + s.id;
        const dur = s.end - s.start;
        // entrance transition
        if (s.tr === "whip") tl.fromTo(el, { xPercent: i % 2 ? -100 : 100 }, { xPercent: 0, duration: 0.24, ease: "expo.out" }, s.start);
        else if (s.tr === "whipUp") tl.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.26, ease: "expo.out" }, s.start);
        else if (s.tr === "punch") tl.fromTo(el, { scale: 1.35, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.3, ease: "power3.out" }, s.start);
        else if (s.tr === "flash") tl.fromTo("#flash", { opacity: 0.85 }, { opacity: 0, duration: 0.25, ease: "power1.out", immediateRender: false }, s.start);
        // motion on every scene
        // brand mark only on clean cards/explainer scenes, never over footage or product UI
        tl.set("#brand", { autoAlpha: s.brand ? 1 : 0 }, s.start);
        if (s.type === "scene") {
          tl.fromTo(el + " .sc", { scale: 1.0 }, { scale: 1.03, duration: dur, ease: "none" }, s.start);
          if (SCENES[s.scene]) SCENES[s.scene](tl, document.querySelector(el), s.start, dur);
        } else if (s.type === "footage") {
          const z = i % 2 ? [1.16, 1.04] : [1.04, 1.16];
          tl.fromTo(el + " .kb", { scale: z[0], xPercent: i % 3 === 0 ? -2 : 2 }, { scale: z[1], xPercent: i % 3 === 0 ? 2 : -2, duration: dur, ease: "none" }, s.start);
        } else {
          tl.fromTo(el + " .card", { scale: 1.0 }, { scale: 1.07, duration: dur, ease: "none" }, s.start);
          tl.from(el + " .card > *:not(.glow)", { y: 80, opacity: 0, duration: 0.45, stagger: 0.08, ease: "back.out(1.6)" }, s.start + 0.05);
          const v = document.querySelector(el + " .stat-val");
          if (v) {
            countUp(tl, v, s.start + 0.05, Math.min(0.9, dur * 0.5));
            tl.fromTo(el + " .glow", { scale: 0.6, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.8, ease: "power2.out" }, s.start);
          }
        }
      });

      // kinetic captions: each word pops in exactly when it is spoken
      DATA.caps.forEach((c) => {
        c.words.forEach((w) => {
          tl.fromTo("#" + w.id, { opacity: 0, scale: 0.55, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.14, ease: "back.out(2.6)" }, w.s);
          tl.to("#" + w.id, { scale: 1.08, duration: 0.08, ease: "power1.out", yoyo: true, repeat: 1 }, w.s + 0.14);
        });
      });

      // shake on the twist
      if (DATA.twistAt) {
        tl.to("#stage", { keyframes: [{ x: -14, y: 6 }, { x: 12, y: -8 }, { x: -8, y: 4 }, { x: 0, y: 0 }], duration: 0.32, ease: "none" }, DATA.twistAt);
        tl.fromTo("#flash", { opacity: 0.7 }, { opacity: 0, duration: 0.3, immediateRender: false }, DATA.twistAt);
      }
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = tl;`;
}

const CSS = `
      @font-face { font-family: "Disp"; src: url("assets/fonts/InterDisplay-Black.otf"); font-weight: 900; }
      @font-face { font-family: "Disp"; src: url("assets/fonts/InterDisplay-Bold.otf"); font-weight: 700; }
      @font-face { font-family: "Text"; src: url("assets/fonts/Inter-Medium.otf"); font-weight: 500; }
      :root { --acc: #314dd0; --acc2: #5b74ff; --hot: #ffd84d; --ink: #05070f; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #000; font-family: "Disp", "Noto Sans Devanagari", sans-serif; }
      #stage { position: absolute; inset: 0; }
      .clip { position: absolute; inset: 0; }
      .shot { overflow: hidden; background: #000; }
      .kb { position: absolute; inset: 0; will-change: transform; }${SCENE_CSS}
      .kb video, .kb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .shade { position: absolute; inset: 0; background:
        linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 75%, rgba(0,0,0,.8) 100%); }
      .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 0 90px 380px; text-align: center; }
      .card.stat { background: radial-gradient(120% 80% at 50% 35%, #12183a 0%, var(--ink) 70%); }
      .card.stat .glow { position: absolute; left: 50%; top: 36%; width: 900px; height: 900px; margin: -450px 0 0 -450px; border-radius: 50%;
        background: radial-gradient(circle, rgba(49,77,208,.55) 0%, rgba(49,77,208,0) 65%); }
      .stat-val { position: relative; font-weight: 900; font-size: 230px; line-height: 1; letter-spacing: -0.05em; color: #fff;
        text-shadow: 0 0 60px rgba(91,116,255,.55); white-space: nowrap; }
      .stat-label { position: relative; margin-top: 34px; font-family: "Text"; font-weight: 500; font-size: 52px; color: var(--hot);
        letter-spacing: 0.02em; text-transform: uppercase; }
      .card.text { background: var(--acc); }
      .card.text.alt { background: #0b0d14; }
      .card-text { font-weight: 900; font-size: 128px; line-height: 1.02; letter-spacing: -0.045em; color: #fff; text-wrap: balance; }
      .card.text.alt .card-text { color: var(--hot); }
      .card.cta { background: radial-gradient(120% 80% at 50% 30%, #3d5cf0 0%, var(--acc) 45%, #1b2a80 100%); padding-bottom: 300px; }
      .cta .logo { width: 190px; height: 190px; margin-bottom: 50px; }
      .cta-kicker { font-family: "Text"; font-size: 54px; color: rgba(255,255,255,.85); letter-spacing: .04em; text-transform: uppercase; }
      .cta-url { margin-top: 18px; font-weight: 900; font-size: 118px; letter-spacing: -0.045em; color: #fff; }
      .cta-sub { margin-top: 26px; font-family: "Text"; font-size: 44px; color: var(--hot); }
      #captions { position: absolute; inset: 0; z-index: 500; pointer-events: none; }
      .cap { display: flex; align-items: center; justify-content: center; top: 1110px; bottom: auto; height: 300px; padding: 0 70px; }
      .cap-line { text-align: center; font-weight: 900; font-size: 104px; line-height: 1.08; letter-spacing: -0.02em; color: #fff; text-transform: uppercase;
        -webkit-text-stroke: 14px #000; paint-order: stroke fill; text-shadow: 0 10px 30px rgba(0,0,0,.6); }
      .cap-line .w { display: inline-block; margin: 0 0.1em; }
      .cap-line .w.long { font-size: 78px; }
      .cap-line .w.hot { color: var(--hot); }
      #brand { position: absolute; z-index: 600; top: 92px; bottom: auto; height: 60px; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 16px;
        font-family: "Text"; font-size: 34px; color: #fff; letter-spacing: .02em; text-shadow: 0 2px 12px rgba(0,0,0,.6); }
      #brand img { width: 46px; height: 46px; }
      #progress { position: absolute; z-index: 600; top: 0; left: 0; width: 100%; height: 12px; background: var(--hot); transform-origin: 0 50%; }
      #flash { position: absolute; inset: 0; z-index: 700; background: #fff; opacity: 0; pointer-events: none; }`;

/** Write a self-contained HyperFrames project for one reel. */
export async function writeProject(projectDir, { timeline, title, bed }) {
  await mkdir(projectDir, { recursive: true });
  await cp(path.join(ROOT, "template", "assets"), path.join(projectDir, "assets"), { recursive: true });
  const tl = timeline;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${esc(title)}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <style>${CSS}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${f(tl.total)}" data-width="${W}" data-height="${H}">
      ${audioHtml(tl, { bed })}
      <div id="stage" class="clip" data-layout-allow-overlap data-start="0" data-duration="${f(tl.total)}">
        ${tl.shots.map(shotHtml).join("\n        ")}
      </div>
      <div id="captions" class="clip" data-layout-allow-overlap data-start="0" data-duration="${f(tl.total)}">
        ${tl.captions.map(captionHtml).join("\n        ")}
      </div>
      <div id="brand" class="clip" data-start="0" data-duration="${f(tl.total)}"><img src="assets/ai-accountant-a-star-white.svg" alt="">AI Accountant</div>
      <div id="progress" class="clip" data-start="0" data-duration="${f(tl.total)}"></div>
      <div id="flash" class="clip" data-start="0" data-duration="${f(tl.total)}"></div>
    </div>
    <script>${timelineJs(tl)}
    </script>
  </body>
</html>
`;
  await writeFile(path.join(projectDir, "index.html"), html);
  return path.join(projectDir, "index.html");
}
