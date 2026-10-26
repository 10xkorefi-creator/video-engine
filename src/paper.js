// "Paper" explainer visuals: numbers are hand-written onto a textured white sheet, the working is
// drawn line by line (marker numbers, pencil labels, a ruled line, a red circle around the answer),
// like a teacher explaining on paper. Used for every stat beat and for paper_math scenes.
// Timing is computed here (Node) so the scribble SFX can be placed on the same beats as the ink.
import { escapeHtml as esc } from "./util.js";

const OPS = { "+": "+", "-": "−", "−": "−", "x": "×", "×": "×", "*": "×", "/": "÷", "÷": "÷", "=": "=" };
const fit = (text, max, width, ratio) => Math.floor(Math.min(max, width / (Math.max(1, String(text).length) * ratio)));
const writeDur = (text) => Math.min(0.75, Math.max(0.28, String(text).length * 0.055));

/** Fit events into the shot. Only items that would run past the end are pulled in (and sped up),
 *  so lines synced to the voice keep their spoken timing. */
function schedule(events, dur) {
  const room = Math.max(0.8, dur - 0.35);
  return events.map((e) => {
    const d = Math.max(0.14, Math.min(e.d, room * 0.25));
    return { ...e, d, t: Math.max(0, Math.min(e.t, room - d)) };
  });
}

// When is a figure spoken? Match its most distinctive token ("15" in "₹15 lakh", "june" in "1 June",
// "138000" in "₹1,38,000") against the word timings inside this shot. Returns a shot-relative time.
const norm = (x) => String(x).toLowerCase().replace(/[,₹]/g, "").replace(/[^a-z0-9.%]/g, "");
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const inWords = (n) => (n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : "") : null);
function spokenAt(value, words, start, after) {
  const toks = String(value || "").split(/\s+/).map(norm).filter(Boolean);
  // most distinctive first: multi-digit numbers (also as words: "fifteen"), then longer words, then single digits
  const cands = [];
  for (const t of toks.filter((t) => /^\d+$/.test(t) && t.length >= 2)) cands.push(t, inWords(+t));
  cands.push(...toks.filter((t) => !/\d/.test(t) && t.length >= 3).sort((a, b) => b.length - a.length));
  for (const t of toks.filter((t) => /\d/.test(t))) cands.push(t, /^\d+$/.test(t) ? inWords(+t) : null);
  for (const key of cands.filter(Boolean)) {
    // a figure spoken a moment before the pen is free still belongs to this line
    const w = words.find((x) => x.start - start >= after - 1.5 && (norm(x.text) === key || (key.length >= 4 && norm(x.text).includes(key))));
    if (w) return w.start - start;
  }
  return null;
}

const attr = (e, start) => `data-t="${(start + e.t).toFixed(3)}" data-d="${e.d.toFixed(3)}"`;

/** One big figure: written in marker, circled in red, label in pencil with a highlighter swipe. */
function statBlock({ value = "", label = "" }, start, dur, words = []) {
  const ev = [];
  const said = spokenAt(value, words, start, 0);
  ev.push({ id: "val", t: said != null ? Math.max(0.15, said - 0.1) : 0.2, d: writeDur(value) + 0.1, sfx: true });
  ev.push({ id: "ring", t: ev[0].t + ev[0].d + 0.05, d: 0.5 });
  ev.push({ id: "hl", t: ev[1].t + 0.25, d: 0.35 });
  ev.push({ id: "lab", t: ev[1].t + 0.3, d: writeDur(label) });
  const s = Object.fromEntries(schedule(ev, dur).map((e) => [e.id, e]));
  const size = fit(value, 250, 860, 0.5);
  const html = `<div class="sc ppr" data-paper="stat" data-focus=".pp-val">
      <div class="pp-cam">
        <div class="pp-stat">
          <div class="pp-val ink pw" ${attr(s.val, start)} style="font-size:${size}px">${esc(value)}</div>
          <div class="pp-statlab"><span class="pp-hl ph" ${attr(s.hl, start)}></span><span class="pencil pw" ${attr(s.lab, start)}>${esc(label)}</span></div>
        </div>
        <svg class="pp-ink"><path class="pc red" data-target=".pp-val" ${attr(s.ring, start)}></path></svg>
      </div>
    </div>`;
  return { html, cues: schedule(ev, dur).filter((e) => e.sfx).map((e) => ({ t: start + e.t, d: e.d })) };
}

/** The working of a calculation: title, 2-4 rows, an operator, a ruled line, the circled result, a note. */
function mathBlock(p, start, dur, words = []) {
  const rows = (Array.isArray(p.rows) ? p.rows : []).slice(0, 4).map((r) => (typeof r === "object" && r ? r : { label: "", value: String(r) }));
  const res = p.result && typeof p.result === "object" ? p.result : p.result ? { label: "", value: String(p.result) } : null;
  // Arithmetic signs only when the working is real arithmetic; a list of facts reads "→ outcome".
  const numeric = (v) => /^\s*₹?\s*[\d.,]+\s*(lakh|crore|k|%|hours?|hrs?|days?|minutes?|mins?|bills?)?\s*$/i.test(String(v || ""));
  const isMath = rows.every((r) => numeric(r.value)) && (!res || numeric(res.value));
  const op = isMath ? OPS[String(p.op || "").trim()] || "" : "";
  const ev = [];
  let c = 0.2;
  if (p.title) {
    const td = Math.min(0.45, writeDur(p.title));
    ev.push({ id: "title", t: 0.05, d: td });
    ev.push({ id: "uline", t: 0.05 + td - 0.05, d: 0.25 });
    c = 0.05 + td + 0.15;
  }
  // Each value is written as it is spoken (label just before it); unspoken ones follow the previous line.
  rows.forEach((r, j) => {
    const dl = writeDur(r.label || ""), dv = writeDur(r.value || "");
    const lead = r.label ? dl * 0.6 : 0;
    const said = spokenAt(r.value, words, start, c);
    const tv = Math.max(c + lead, said != null ? said - 0.12 : c + lead);
    if (r.label) ev.push({ id: `l${j}`, t: tv - lead, d: dl });
    ev.push({ id: `v${j}`, t: tv, d: dv, sfx: true });
    c = tv + Math.max(dv, 0.45) + 0.18;
  });
  if (res) {
    const said = spokenAt(res.value, words, start, c);
    const rlead = 0.32 + (res.label ? 0.2 : 0);
    if (said != null && said - 0.12 - rlead > c) c = said - 0.12 - rlead;
    ev.push({ id: "rule", t: c, d: 0.3 });
    c += 0.32;
    if (res.label) ev.push({ id: "rl", t: c, d: writeDur(res.label) });
    ev.push({ id: "rv", t: c + (res.label ? 0.2 : 0), d: writeDur(res.value) + 0.1, sfx: true });
    c += (res.label ? 0.2 : 0) + writeDur(res.value) + 0.15;
    ev.push({ id: "ring", t: c, d: 0.5 });
    c += 0.45;
  }
  if (p.note) ev.push({ id: "note", t: c, d: writeDur(p.note) });
  const sch = schedule(ev, dur);
  const s = Object.fromEntries(sch.map((e) => [e.id, e]));
  const at = (id) => (s[id] ? attr(s[id], start) : "");
  // fewer lines = bigger writing, so the sheet is used properly
  const big = rows.length <= 2;
  const vsize = Math.min(...rows.map((r) => fit(r.value, big ? 120 : 90, big ? 560 : 520, 0.5)), big ? 120 : 90);
  const lsize = big ? 78 : 64;
  const rsize = res ? fit(res.value, big ? 180 : 150, 820, 0.5) : 0;
  const html = `<div class="sc ppr" data-paper="math" data-focus="${res ? ".pp-res .pp-v" : ".pp-rows"}">
      <div class="pp-cam">
        ${p.title ? `<div class="pp-title pw blue" ${at("title")}>${esc(p.title)}</div><svg class="pp-ink"><path class="pd blue" data-under=".pp-title" ${at("uline")}></path></svg>` : ""}
        <div class="pp-rows${p.title ? "" : " notitle"}">
          ${rows.map((r, j) => `<div class="pp-row" style="min-height:${big ? 160 : 120}px">
            <span class="pp-op ink pw" ${at(`v${j}`)}>${j === rows.length - 1 && op && rows.length > 1 ? op : ""}</span>
            <span class="pp-l pencil pw" ${at(`l${j}`)} style="font-size:${lsize}px">${esc(r.label || "")}</span>
            <span class="pp-v ink pw" ${at(`v${j}`)} style="font-size:${vsize}px">${esc(r.value || "")}</span></div>`).join("")}
          ${res ? `<div class="pp-res">
            <div class="pp-rl"><span class="pp-op ink pw" ${at("rv")}>${isMath ? "=" : "→"}</span><span class="pencil pw" ${at("rl")}>${esc(res.label || "")}</span></div>
            <div class="pp-rv"><span class="pp-v red pw" ${at("rv")} style="font-size:${rsize}px">${esc(res.value)}</span></div></div>` : ""}
          ${p.note ? `<div class="pp-note blue pw" ${at("note")}>↳ ${esc(p.note)}</div>` : ""}
        </div>
        ${res ? `<svg class="pp-ink"><path class="pd ink" data-rule="1" ${at("rule")}></path><path class="pc red" data-target=".pp-res .pp-v" ${at("ring")}></path></svg>` : ""}
      </div>
    </div>`;
  return { html, cues: sch.filter((e) => e.sfx).map((e) => ({ t: start + e.t, d: e.d })) };
}

/** kind: "stat" (params {value,label}) or "math" (paper_math params). */
export function paperBlock(kind, params, start, dur, words = []) {
  return kind === "stat" ? statBlock(params || {}, start, dur, words) : mathBlock(params || {}, start, dur, words);
}

// Paper texture: warm off-white, faint grid, a red margin line, fibre noise and an edge vignette.
const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .40  0 0 0 0 .32  0 0 0 .32 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`;
const FIBRE = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".012 .09" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .35  0 0 0 .14 0"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>')}")`;

export const PAPER_CSS = `
      @font-face { font-family: "Marker"; src: url("assets/fonts/Kalam-Bold.ttf"); font-weight: 700; }
      @font-face { font-family: "Pencil"; src: url("assets/fonts/Caveat-Variable.ttf"); font-weight: 400 700; }
      .sc.ppr { background-color: #fdfcf8;
        background-image: radial-gradient(130% 95% at 50% 40%, rgba(255,255,255,0) 55%, rgba(120,98,60,.13) 100%), ${NOISE}, ${FIBRE},
          linear-gradient(90deg, transparent 118px, rgba(214,56,47,.32) 118px, rgba(214,56,47,.32) 121px, transparent 121px),
          repeating-linear-gradient(0deg, rgba(70,100,190,.11) 0 2px, transparent 2px 60px),
          repeating-linear-gradient(90deg, rgba(70,100,190,.07) 0 2px, transparent 2px 60px);
        background-size: 100% 100%, 400px 400px, 900px 900px, 100% 100%, 100% 100%, 100% 100%; }
      .pp-cam { position: absolute; inset: 0; transform-origin: 50% 40%; }
      .pp-ink { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: visible; pointer-events: none; }
      .pp-ink path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .pp-ink .red { stroke: #e03a2f; stroke-width: 11; } .pp-ink .blue { stroke: #2a4fd6; stroke-width: 8; } .pp-ink .ink { stroke: #1d1f2b; stroke-width: 7; }
      .ink { color: #1d1f2b; font-family: "Marker"; } .red { color: #e03a2f; font-family: "Marker"; } .blue { color: #2a4fd6; font-family: "Marker"; }
      .pencil { color: #4f535e; font-family: "Pencil"; font-weight: 600; }
      .pp-title { position: absolute; top: 210px; left: 150px; right: 90px; font-size: 76px; line-height: 1.05; transform: rotate(-1.2deg); }
      .pp-rows { position: absolute; top: 370px; left: 150px; right: 90px; }
      .pp-rows.notitle { top: 300px; }
      .pp-row { position: relative; display: flex; align-items: baseline; gap: 22px; min-height: 120px; }
      .pp-op { width: 60px; font-size: 90px; text-align: center; flex: none; }
      .pp-l { flex: 1; font-size: 64px; line-height: 1.0; }
      .pp-v { white-space: nowrap; line-height: 1.05; }
      .pp-res { margin-top: 40px; }
      .pp-rl { display: flex; align-items: baseline; gap: 22px; font-size: 70px; line-height: 1.0; }
      .pp-rv { text-align: right; margin-top: 34px; padding-right: 40px; }
      .pp-note { margin-top: 36px; font-size: 62px; line-height: 1.05; transform: rotate(-1deg); }
      .pp-stat { position: absolute; top: 260px; left: 90px; right: 90px; height: 780px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .pp-stat .pp-val { line-height: 1.0; white-space: nowrap; transform: rotate(-2deg); }
      .pp-statlab { position: relative; margin-top: 70px; font-size: 76px; line-height: 1.05; max-width: 880px; }
      .pp-statlab .pencil { position: relative; }
      .pp-hl { position: absolute; left: -24px; right: -24px; top: 38%; height: 52%; background: rgba(255,214,0,.55); border-radius: 10px; transform-origin: 0 50%; mix-blend-mode: multiply; }
      .pw { display: inline-block; }`;

/** Browser-side: seek-safe ink animation driven by data-t/data-d on each element. */
export const PAPER_JS = `
      // Hand-drawn path helpers (seeded wobble so every render is identical).
      function rnd(seed) { let x = Math.sin(seed * 9301.17) * 43758.5453; return x - Math.floor(x); }
      function offsetIn(el, root) { let x = 0, y = 0, n = el; while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
      function ringPath(b, seed) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + 46, ry = b.h / 2 + 30;
        let d = "";
        for (let i = 0; i <= 44; i++) {
          const a = -2.3 + (i / 44) * Math.PI * 2.18, wob = 1 + (rnd(seed + i) - .5) * .05;
          d += (i ? " L " : "M ") + (cx + Math.cos(a) * rx * wob).toFixed(1) + " " + (cy + Math.sin(a) * ry * wob).toFixed(1);
        }
        return d;
      }
      function linePath(x1, x2, y, seed) {
        let d = "";
        for (let i = 0; i <= 16; i++) { const x = x1 + (x2 - x1) * i / 16, yy = y + Math.sin(i * 1.3 + seed) * 2.5 + (rnd(seed + i) - .5) * 3; d += (i ? " L " : "M ") + x.toFixed(1) + " " + yy.toFixed(1); }
        return d;
      }
      function paperAnim(tl, shot, start, dur) {
        const sc = shot.querySelector(".sc.ppr"), cam = sc.querySelector(".pp-cam");
        const T = (e) => parseFloat(e.dataset.t), D = (e) => parseFloat(e.dataset.d);
        // keep the paper clear of the caption text (y > 1150): drop the note, then shrink the sheet if still too tall
        const note = sc.querySelector(".pp-note");
        const bottom = () => Math.max(...[...cam.children].filter((n) => n.tagName !== "svg").map((n) => { const b = offsetIn(n, cam); return b.y + b.h; }));
        if (note && bottom() > 1150) note.style.display = "none";
        const rows = sc.querySelector(".pp-rows");
        if (rows && bottom() > 1150) { const b = offsetIn(rows, cam); const k = Math.max(.7, (1150 - b.y) / b.h); rows.style.transformOrigin = "0 0"; rows.style.zoom = k; }
        // shape the hand-drawn strokes from the laid-out text
        sc.querySelectorAll("path.pc").forEach((p, k) => { const t = sc.querySelector(p.dataset.target); if (t) p.setAttribute("d", ringPath(offsetIn(t, cam), 11 + k)); });
        sc.querySelectorAll("path[data-under]").forEach((p, k) => { const t = sc.querySelector(p.dataset.under); if (t) { const b = offsetIn(t, cam); p.setAttribute("d", linePath(b.x, b.x + Math.min(b.w, 760), b.y + b.h + 10, 3 + k)); } });
        sc.querySelectorAll("path[data-rule]").forEach((p, k) => { const rows = sc.querySelectorAll(".pp-row"); const last = rows[rows.length - 1]; if (last) { const b = offsetIn(last, cam); p.setAttribute("d", linePath(b.x + 10, b.x + b.w, b.y + b.h + 16, 7 + k)); } });
        // writing: reveal each word left-to-right like a pen
        sc.querySelectorAll(".pw[data-t]").forEach((e) => {
          tl.fromTo(e, { clipPath: "inset(-20% 101% -20% -4%)" }, { clipPath: "inset(-20% -4% -20% -4%)", duration: D(e), ease: "none", immediateRender: true }, T(e));
        });
        // strokes: draw on with dash offset
        sc.querySelectorAll("path[data-t]").forEach((p) => {
          const L = p.getTotalLength ? p.getTotalLength() : 1200;
          p.style.strokeDasharray = L + " " + (L + 40);
          tl.fromTo(p, { strokeDashoffset: L + 20 }, { strokeDashoffset: 0, duration: D(p), ease: "power1.inOut", immediateRender: true }, T(p));
        });
        sc.querySelectorAll(".ph[data-t]").forEach((h) => tl.fromTo(h, { scaleX: 0 }, { scaleX: 1, duration: D(h), ease: "power2.out", immediateRender: true }, T(h)));
        // pattern interrupt: a quick push-in every time a new figure is written, so the sheet never sits still
        sc.querySelectorAll(".pp-v[data-t], .pp-stat .pp-val[data-t]").forEach((v) =>
          tl.fromTo(sc, { scale: 1.06 }, { scale: 1, duration: .4, ease: "power3.out", immediateRender: false }, T(v)));
        // the answer gets a small ink "pop" when it lands
        const ring = sc.querySelector("path.pc[data-t]");
        const focus = sc.querySelector(sc.dataset.focus);
        if (ring && focus) tl.fromTo(focus, { scale: 1 }, { scale: 1.08, duration: .16, yoyo: true, repeat: 1, ease: "power2.out", immediateRender: false }, T(ring));
        // camera: slow drift, then ease in toward the answer
        if (focus) { const b = offsetIn(focus, cam); cam.style.transformOrigin = (b.x + b.w / 2) + "px " + (b.y + b.h / 2) + "px"; }
        tl.fromTo(cam, { scale: 1.0, rotation: -0.5, y: 10 }, { scale: 1.07, rotation: 0.4, y: -10, duration: dur, ease: "sine.inOut" }, start);
      }`;
