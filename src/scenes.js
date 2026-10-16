// Animated scene library: product scenes (AI Accountant UI mock-ups) and explainer scenes.
// Each scene = static HTML (filled from the script's params) + a seek-safe GSAP builder.
// Layout keeps content in y 180..1060 so captions (y ~1110..1410) stay readable.
import { escapeHtml as esc } from "./util.js";

export const SCENE_KINDS = {
  bills_flow: "AiA product: paper bills fly into the AI Accountant dashboard, rows fill in with ticks, then 'Synced to Tally'. params: {title?, items?: [3-5 short bill labels e.g. 'Raw material', 'Freight'], footer?}",
  bank_match: "AiA product: bank statement lines slide in and connect to matching bills. params: {title?, lines?: [3-4 short bank line labels], bills?: [3-4 short bill labels]}",
  gst_match: "AiA product: 'Your books' vs government GST list; rows turn green, one mismatch flashes red. params: {left?, right?, rows?: [4-5 short labels], mismatch_label?}",
  whatsapp: "AiA product: phone chat; owner asks a question, AI Accountant answers. params: {question, answer} (Roman Hinglish or English, short)",
  deadline: "Explainer: calendar page, a date gets circled, countdown, red stamp. params: {month: e.g. 'OCTOBER', day: number 1-31, caption?: e.g. 'GSTR-3B due', stamp?: e.g. 'LATE'}",
  meter: "Explainer: rupee meter ticking up day by day. params: {value: exact figure from this beat e.g. '₹50', unit?: e.g. 'per day', label?}",
  split: "Explainer: two founders side by side, chaos vs calm system. params: {left_title, right_title, left_points: [2-3 short], right_points: [2-3 short]}",
  flow: "Explainer: 3-4 steps connected by animated arrows. params: {steps: [3-4 one-or-two-word steps], title?}",
};

const PRODUCT = new Set(["bills_flow", "bank_match", "gst_match", "whatsapp"]);
export const isProductScene = (k) => PRODUCT.has(k);

const list = (a, n, dflt) => (Array.isArray(a) && a.length ? a : dflt).slice(0, n).map((x) => esc(String(x)));
const AMOUNTS = ["₹12,400", "₹8,750", "₹46,200", "₹3,180", "₹21,900"]; // decorative UI values, never narrated

const logoHead = (label) => `<div class="ui-head"><img src="assets/ai-accountant-a-star.svg" alt=""><span class="ui-brand">AI Accountant</span><span class="ui-tab">${esc(label)}</span></div>`;

export function sceneHtml(v) {
  const p = v.params || {};
  const k = v.scene;
  if (k === "bills_flow") {
    const items = list(p.items, 4, ["Raw material", "Freight", "Packaging", "Office rent"]);
    return `<div class="sc sc-light" data-scene="bills_flow">
      <div class="sc-title">${esc(p.title || "Bills, read by AI")}</div>
      <div class="paper-stack">${items.map((_, j) => `<div class="paper p${j}"><i></i><i></i><i class="s"></i><i></i><b>${AMOUNTS[j]}</b></div>`).join("")}</div>
      <div class="ui-panel">${logoHead("Bills")}
        ${items.map((it, j) => `<div class="ui-row r${j}"><span class="ui-dot"></span><span class="ui-name">${it}</span><span class="ui-amt">${AMOUNTS[j]}</span><span class="ui-chip">✓ Read</span></div>`).join("")}
      </div>
      <div class="sc-banner">${esc(p.footer || "Synced to Tally ✓")}</div></div>`;
  }
  if (k === "bank_match") {
    const lines = list(p.lines, 4, ["NEFT · Supplier", "UPI · Freight", "RTGS · Raw material", "IMPS · Packaging"]);
    const bills = list(p.bills, lines.length, ["Bill · Supplier", "Bill · Freight", "Bill · Raw material", "Bill · Packaging"]);
    return `<div class="sc sc-light" data-scene="bank_match">
      <div class="sc-title">${esc(p.title || "Bank lines ↔ bills")}</div>
      <div class="ui-panel wide">${logoHead("Banking")}
        <div class="bm-cols"><div class="bm-col"><div class="bm-h">Bank statement</div>${lines.map((l, j) => `<div class="bm-item bl b${j}">${l}<em>${AMOUNTS[j]}</em></div>`).join("")}</div>
        <div class="bm-col"><div class="bm-h">Open bills</div>${bills.map((l, j) => `<div class="bm-item br r${j}">${l}<em>${AMOUNTS[j]}</em></div>`).join("")}</div></div>
        ${lines.map((_, j) => `<div class="bm-link k${j}" style="top:${232 + j * 128}px"><span>Matched ✓</span></div>`).join("")}
      </div></div>`;
  }
  if (k === "gst_match") {
    const rows = list(p.rows, 5, ["Supplier A invoice", "Supplier B invoice", "Supplier C invoice", "Supplier D invoice", "Supplier E invoice"]);
    return `<div class="sc sc-light" data-scene="gst_match">
      <div class="sc-title">${esc(p.title || "Books vs GST list")}</div>
      <div class="ui-panel wide">${logoHead("GST")}
        <div class="gm-head"><span>${esc(p.left || "Your books")}</span><span>${esc(p.right || "GSTR-2B (govt list)")}</span></div>
        ${rows.map((r, j) => `<div class="gm-row g${j}${j === rows.length - 2 ? " bad" : ""}"><span>${r}</span><span class="gm-st">${j === rows.length - 2 ? "✗ " + esc(p.mismatch_label || "Missing") : "✓ Match"}</span></div>`).join("")}
      </div></div>`;
  }
  if (k === "whatsapp") {
    return `<div class="sc sc-dark" data-scene="whatsapp">
      <div class="phone"><div class="ph-top"><img src="assets/ai-accountant-a-star-white.svg" alt=""><span>AI Accountant</span></div>
        <div class="bubble me">${esc(p.question || "Aaj kitna cash hai?")}</div>
        <div class="typing"><i></i><i></i><i></i></div>
        <div class="bubble bot">${esc(p.answer || "Bank balance, dues and payables, all here 👇")}</div>
        <div class="mini-bars"><i></i><i></i><i></i><i></i><i></i></div>
      </div></div>`;
  }
  if (k === "deadline") {
    const day = Math.min(31, Math.max(1, parseInt(p.day, 10) || 20));
    const cells = Array.from({ length: 35 }, (_, j) => j + 1).map((d) =>
      `<span class="cal-d${d === day ? " target" : ""}">${d <= 31 ? d : ""}</span>`).join("");
    return `<div class="sc sc-dark" data-scene="deadline">
      <div class="cal"><div class="cal-m">${esc(p.month || "THIS MONTH")}</div><div class="cal-g">${cells}</div><div class="cal-ring"></div></div>
      <div class="cal-cap">${esc(p.caption || "Due date")}</div>
      <div class="stamp">${esc(p.stamp || "LATE")}</div></div>`;
  }
  if (k === "meter") {
    return `<div class="sc sc-dark" data-scene="meter">
      <div class="meter"><div class="meter-ring"></div><div class="meter-val" data-count="${esc(p.value || "")}">${esc(p.value || "")}</div><div class="meter-unit">${esc(p.unit || "")}</div></div>
      <div class="meter-label">${esc(p.label || "")}</div>
      <div class="meter-days">${Array.from({ length: 10 }, (_, j) => `<i class="d${j}"></i>`).join("")}</div></div>`;
  }
  if (k === "split") {
    const L = list(p.left_points, 3, ["Typing late at night", "Missed entries"]);
    const R = list(p.right_points, 3, ["Bills auto-read", "Team just approves"]);
    return `<div class="sc sc-dark" data-scene="split">
      <div class="sp sp-l"><div class="sp-t">${esc(p.left_title || "Founder A")}</div>${L.map((x) => `<div class="sp-p bad">✗ ${x}</div>`).join("")}<div class="sp-papers"><i></i><i></i><i></i></div></div>
      <div class="sp sp-r"><div class="sp-t">${esc(p.right_title || "Founder B")}</div>${R.map((x) => `<div class="sp-p good">✓ ${x}</div>`).join("")}<div class="sp-check">✓</div></div>
      <div class="sp-vs">VS</div></div>`;
  }
  if (k === "flow") {
    const steps = list(p.steps, 4, ["Bill", "AI reads", "Approve", "Tally"]);
    return `<div class="sc sc-dark" data-scene="flow">
      ${p.title ? `<div class="sc-title light">${esc(p.title)}</div>` : ""}
      <div class="fl">${steps.map((st, j) => `<div class="fl-step f${j}"><span class="fl-n">${j + 1}</span><span class="fl-t">${st}</span></div>${j < steps.length - 1 ? `<div class="fl-arrow a${j}"><i></i></div>` : ""}`).join("")}</div></div>`;
  }
  return `<div class="sc sc-dark"><div class="sc-title light">${esc(p.title || "")}</div></div>`;
}

export const SCENE_CSS = `
      .sc { position: absolute; inset: 0; overflow: hidden; }
      .sc-light { background: linear-gradient(180deg, #f3f5fb 0%, #e8ecf8 100%); }
      .sc-dark { background: radial-gradient(120% 80% at 50% 30%, #141a3a 0%, #05070f 75%); }
      .sc-title { position: absolute; top: 190px; left: 0; right: 0; text-align: center; font-weight: 900; font-size: 64px; letter-spacing: -0.04em; color: #0b0d14; }
      .sc-title.light { color: #fff; }
      .ui-panel { position: absolute; left: 130px; right: 130px; top: 320px; height: 700px; background: #fff; border-radius: 36px;
        box-shadow: 0 40px 90px rgba(20,30,80,.18); padding: 0 34px; overflow: hidden; }
      .ui-panel.wide { left: 70px; right: 70px; }
      .ui-head { display: flex; align-items: center; gap: 14px; height: 104px; border-bottom: 2px solid #eef0f6; margin: 0 -34px 18px; padding: 0 34px; }
      .ui-head img { width: 46px; height: 46px; }
      .ui-brand { font-family: "Text"; font-size: 34px; color: #0b0d14; }
      .ui-tab { margin-left: auto; font-family: "Text"; font-size: 28px; color: #314dd0; background: rgba(49,77,208,.1); padding: 8px 20px; border-radius: 30px; }
      .ui-row { display: flex; align-items: center; gap: 18px; height: 112px; border-bottom: 1.5px solid #f0f2f7; font-family: "Text"; font-size: 34px; color: #222; }
      .ui-dot { width: 18px; height: 18px; border-radius: 50%; background: #314dd0; }
      .ui-name { flex: 1; }
      .ui-amt { color: #555; }
      .ui-chip { font-size: 26px; color: #0f8a4b; background: rgba(15,138,75,.1); padding: 8px 16px; border-radius: 20px; }
      .paper-stack { position: absolute; top: 300px; left: 0; right: 0; height: 10px; }
      .paper { position: absolute; left: 420px; top: 0; width: 240px; height: 300px; background: #fffdf6; border-radius: 10px; box-shadow: 0 16px 40px rgba(0,0,0,.18); padding: 30px 26px; }
      .paper i { display: block; height: 12px; background: #d9dce6; border-radius: 6px; margin-bottom: 22px; }
      .paper i.s { width: 60%; }
      .paper b { position: absolute; bottom: 26px; right: 26px; font-family: "Text"; font-size: 30px; color: #0b0d14; }
      .sc-banner { position: absolute; top: 1040px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: #314dd0; color: #fff; font-family: "Text";
        font-size: 40px; padding: 18px 40px; border-radius: 50px; box-shadow: 0 20px 40px rgba(49,77,208,.35); }
      .bm-cols { display: flex; gap: 120px; }
      .bm-col { flex: 1; }
      .bm-h { font-family: "Text"; font-size: 28px; color: #888; height: 50px; }
      .bm-item { position: relative; height: 104px; margin-bottom: 24px; border-radius: 18px; background: #f4f6fb; font-family: "Text"; font-size: 28px; color: #222; padding: 18px 20px; line-height: 1.25; }
      .bm-item em { display: block; font-style: normal; color: #314dd0; font-size: 30px; }
      .bm-link { position: absolute; left: 50%; width: 140px; margin-left: -70px; height: 6px; background: #0f8a4b; border-radius: 3px; transform-origin: 0 50%; }
      .bm-link span { position: absolute; left: 50%; top: -48px; transform: translateX(-50%); font-family: "Text"; font-size: 22px; color: #0f8a4b; white-space: nowrap; }
      .gm-head { display: flex; justify-content: space-between; font-family: "Text"; font-size: 28px; color: #888; margin-bottom: 10px; }
      .gm-row { display: flex; justify-content: space-between; align-items: center; height: 100px; padding: 0 24px; margin-bottom: 14px; border-radius: 18px; background: #f4f6fb; font-family: "Text"; font-size: 32px; color: #222; }
      .gm-st { color: #0f8a4b; }
      .gm-row.bad .gm-st { color: #d92d20; }
      .phone { position: absolute; left: 230px; top: 200px; width: 620px; height: 860px; border-radius: 60px; background: #ece5dd; border: 14px solid #10131c; overflow: hidden; }
      .ph-top { display: flex; align-items: center; gap: 16px; height: 120px; background: #075e54; padding: 0 30px; color: #fff; font-family: "Text"; font-size: 34px; }
      .ph-top img { width: 52px; height: 52px; }
      .bubble { position: absolute; max-width: 470px; padding: 22px 26px; border-radius: 26px; font-family: "Text"; font-size: 34px; line-height: 1.25; color: #111; box-shadow: 0 4px 10px rgba(0,0,0,.08); }
      .bubble.me { right: 26px; top: 170px; background: #dcf8c6; }
      .bubble.bot { left: 26px; top: 360px; background: #fff; }
      .typing { position: absolute; left: 26px; top: 360px; background: #fff; border-radius: 26px; padding: 26px 28px; display: flex; gap: 10px; }
      .typing i { width: 16px; height: 16px; border-radius: 50%; background: #999; display: block; }
      .mini-bars { position: absolute; left: 60px; right: 60px; bottom: 80px; height: 220px; display: flex; align-items: flex-end; gap: 22px; }
      .mini-bars i { flex: 1; background: #314dd0; border-radius: 10px 10px 0 0; display: block; transform-origin: 50% 100%; }
      .mini-bars i:nth-child(1) { height: 40%; } .mini-bars i:nth-child(2) { height: 70%; } .mini-bars i:nth-child(3) { height: 55%; }
      .mini-bars i:nth-child(4) { height: 90%; } .mini-bars i:nth-child(5) { height: 65%; }
      .cal { position: absolute; left: 150px; top: 230px; width: 780px; height: 720px; background: #fff; border-radius: 34px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.4); }
      .cal-m { height: 130px; background: #314dd0; color: #fff; font-weight: 900; font-size: 64px; letter-spacing: .02em; display: flex; align-items: center; justify-content: center; }
      .cal-g { display: grid; grid-template-columns: repeat(7, 1fr); padding: 20px; gap: 6px; }
      .cal-d { height: 104px; display: flex; align-items: center; justify-content: center; font-family: "Text"; font-size: 40px; color: #333; }
      .cal-d.target { color: #314dd0; font-weight: 900; }
      .cal-ring { position: absolute; width: 130px; height: 130px; border: 10px solid #d92d20; border-radius: 50%; }
      .cal-cap { position: absolute; top: 990px; left: 0; right: 0; text-align: center; color: #ffd84d; font-family: "Text"; font-size: 54px; text-transform: uppercase; letter-spacing: .03em; }
      .stamp { position: absolute; left: 50%; top: 500px; transform: translate(-50%, -50%) rotate(-14deg); border: 14px solid #d92d20; color: #d92d20; font-weight: 900;
        font-size: 170px; padding: 0 40px; border-radius: 24px; background: rgba(255,255,255,.85); letter-spacing: .04em; }
      .meter { position: absolute; left: 50%; top: 560px; width: 640px; height: 640px; margin: -320px 0 0 -320px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .meter-ring { position: absolute; inset: 0; border-radius: 50%; border: 22px solid rgba(255,255,255,.08); border-top-color: #d92d20; border-right-color: #d92d20; }
      .meter-val { font-weight: 900; font-size: 190px; color: #fff; letter-spacing: -.05em; }
      .meter-unit { font-family: "Text"; font-size: 50px; color: #ffd84d; text-transform: uppercase; }
      .meter-label { position: absolute; top: 950px; left: 0; right: 0; text-align: center; font-family: "Text"; font-size: 48px; color: rgba(255,255,255,.85); }
      .meter-days { position: absolute; top: 210px; left: 190px; right: 190px; display: flex; gap: 14px; }
      .meter-days i { flex: 1; height: 26px; border-radius: 13px; background: #d92d20; display: block; }
      .sp { position: absolute; top: 220px; width: 470px; height: 800px; border-radius: 34px; padding: 40px 34px; }
      .sp-l { left: 50px; background: rgba(217,45,32,.12); border: 3px solid rgba(217,45,32,.5); }
      .sp-r { right: 50px; background: rgba(49,77,208,.18); border: 3px solid rgba(91,116,255,.6); }
      .sp-t { font-weight: 900; font-size: 58px; color: #fff; margin-bottom: 40px; letter-spacing: -.03em; }
      .sp-p { font-family: "Text"; font-size: 38px; line-height: 1.2; margin-bottom: 34px; }
      .sp-p.bad { color: #ff8a80; } .sp-p.good { color: #b8c5ff; }
      .sp-papers i { position: absolute; width: 120px; height: 150px; background: #fffdf6; border-radius: 8px; bottom: 60px; left: 170px; display: block; }
      .sp-check { position: absolute; bottom: 60px; left: 50%; margin-left: -80px; width: 160px; height: 160px; border-radius: 50%; background: #314dd0; color: #fff;
        font-size: 100px; display: flex; align-items: center; justify-content: center; }
      .sp-vs { position: absolute; left: 50%; top: 560px; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; background: #ffd84d; color: #05070f;
        font-weight: 900; font-size: 50px; display: flex; align-items: center; justify-content: center; }
      .fl { position: absolute; top: 300px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; }
      .fl-step { width: 720px; height: 150px; border-radius: 30px; background: rgba(255,255,255,.08); border: 3px solid rgba(91,116,255,.6); display: flex; align-items: center; gap: 30px; padding: 0 40px; }
      .fl-n { width: 84px; height: 84px; border-radius: 50%; background: #314dd0; color: #fff; font-weight: 900; font-size: 46px; display: flex; align-items: center; justify-content: center; }
      .fl-t { font-weight: 900; font-size: 60px; color: #fff; letter-spacing: -.03em; }
      .fl-arrow { height: 60px; width: 8px; position: relative; }
      .fl-arrow i { position: absolute; inset: 0; background: #ffd84d; border-radius: 4px; transform-origin: 50% 0; display: block; }
      .fl-arrow i::after { content: ""; position: absolute; left: -12px; bottom: -14px; border: 16px solid transparent; border-top-color: #ffd84d; }`;

/** Browser-side animation builders; injected into the composition script. Times are absolute (seek-safe). */
export const SCENE_JS = `
      const SCENES = {
        bills_flow(tl, el, t, d) {
          const papers = el.querySelectorAll(".paper"), rows = el.querySelectorAll(".ui-row");
          tl.fromTo(el.querySelector(".ui-panel"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out" }, t);
          const step = Math.min(0.55, (d - 1.6) / Math.max(1, papers.length));
          papers.forEach((p, j) => {
            const tt = t + .25 + j * step;
            tl.fromTo(p, { y: -520, x: (j % 2 ? 140 : -140), rotation: (j % 2 ? 12 : -12), opacity: 1 }, { y: 360, x: 0, rotation: 0, opacity: 0, duration: .6, ease: "power2.in", immediateRender: true }, tt);
            tl.fromTo(rows[j], { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: .3, ease: "back.out(2)", immediateRender: true }, tt + .55);
            tl.fromTo(rows[j].querySelector(".ui-chip"), { scale: 0 }, { scale: 1, duration: .25, ease: "back.out(3)", immediateRender: true }, tt + .8);
          });
          tl.fromTo(el.querySelector(".sc-banner"), { y: 60, opacity: 0, scale: .8 }, { y: 0, opacity: 1, scale: 1, duration: .4, ease: "back.out(2)", immediateRender: true }, Math.min(t + d - .8, t + .4 + papers.length * step + .6));
        },
        bank_match(tl, el, t, d) {
          const bl = el.querySelectorAll(".bl"), br = el.querySelectorAll(".br"), lk = el.querySelectorAll(".bm-link");
          tl.fromTo(el.querySelector(".ui-panel"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out" }, t);
          const step = Math.min(.7, (d - 1) / Math.max(1, bl.length));
          bl.forEach((b, j) => {
            const tt = t + .4 + j * step;
            tl.fromTo(b, { x: -200, opacity: 0 }, { x: 0, opacity: 1, duration: .35, ease: "power3.out", immediateRender: true }, tt);
            tl.fromTo(br[j], { x: 200, opacity: 0 }, { x: 0, opacity: 1, duration: .35, ease: "power3.out", immediateRender: true }, tt + .1);
            tl.fromTo(lk[j], { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: .3, ease: "power2.out", immediateRender: true }, tt + .4);
            tl.to([b, br[j]], { backgroundColor: "rgba(15,138,75,.12)", duration: .2 }, tt + .65);
          });
        },
        gst_match(tl, el, t, d) {
          const rows = el.querySelectorAll(".gm-row");
          tl.fromTo(el.querySelector(".ui-panel"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out" }, t);
          const step = Math.min(.6, (d - 1.2) / Math.max(1, rows.length));
          rows.forEach((r, j) => {
            const tt = t + .4 + j * step, bad = r.classList.contains("bad");
            tl.fromTo(r, { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: .3, ease: "power3.out", immediateRender: true }, tt);
            tl.fromTo(r.querySelector(".gm-st"), { scale: 0 }, { scale: 1, duration: .25, ease: "back.out(3)", immediateRender: true }, tt + .3);
            tl.to(r, { backgroundColor: bad ? "rgba(217,45,32,.14)" : "rgba(15,138,75,.10)", duration: .2 }, tt + .3);
            if (bad) tl.to(r, { keyframes: [{ x: -14 }, { x: 14 }, { x: -8 }, { x: 0 }], duration: .35 }, tt + .55);
          });
        },
        whatsapp(tl, el, t, d) {
          tl.fromTo(el.querySelector(".phone"), { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out" }, t);
          tl.fromTo(el.querySelector(".me"), { scale: 0, transformOrigin: "100% 100%" }, { scale: 1, duration: .35, ease: "back.out(2)", immediateRender: true }, t + .5);
          tl.fromTo(el.querySelector(".typing"), { opacity: 0 }, { opacity: 1, duration: .15, immediateRender: true }, t + 1.0);
          tl.to(el.querySelectorAll(".typing i"), { y: -10, duration: .2, stagger: .1, yoyo: true, repeat: 3 }, t + 1.0);
          tl.to(el.querySelector(".typing"), { opacity: 0, duration: .1 }, t + 1.9);
          tl.fromTo(el.querySelector(".bot"), { scale: 0, transformOrigin: "0% 100%" }, { scale: 1, duration: .35, ease: "back.out(2)", immediateRender: true }, t + 2.0);
          tl.fromTo(el.querySelectorAll(".mini-bars i"), { scaleY: 0 }, { scaleY: 1, duration: .4, stagger: .08, ease: "power2.out", immediateRender: true }, t + 2.4);
        },
        deadline(tl, el, t, d) {
          const cal = el.querySelector(".cal"), tgt = el.querySelector(".target"), ring = el.querySelector(".cal-ring");
          tl.fromTo(cal, { y: 120, opacity: 0, rotation: -4 }, { y: 0, opacity: 1, rotation: 0, duration: .5, ease: "power3.out" }, t);
          ring.style.left = (tgt.offsetLeft + tgt.offsetWidth / 2 - 65) + "px";
          ring.style.top = (tgt.offsetTop + tgt.offsetHeight / 2 - 65) + "px";
          tl.fromTo(ring, { scale: 2.4, opacity: 0 }, { scale: 1, opacity: 1, duration: .45, ease: "back.out(2)", immediateRender: true }, t + .7);
          tl.fromTo(el.querySelector(".cal-cap"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .4, immediateRender: true }, t + 1.0);
          tl.fromTo(el.querySelector(".stamp"), { scale: 3, opacity: 0 }, { scale: 1, opacity: 1, duration: .3, ease: "power4.in", immediateRender: true }, Math.max(t + 1.5, t + d - 1.2));
        },
        meter(tl, el, t, d) {
          tl.fromTo(el.querySelector(".meter"), { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: "back.out(1.6)" }, t);
          tl.fromTo(el.querySelector(".meter-ring"), { rotation: -90 }, { rotation: 270, duration: d, ease: "none" }, t);
          tl.fromTo(el.querySelectorAll(".meter-days i"), { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: .15, stagger: Math.min(.25, (d - .6) / 10), immediateRender: true }, t + .3);
          tl.fromTo(el.querySelector(".meter-label"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .4, immediateRender: true }, t + .6);
          countUp(tl, el.querySelector(".meter-val"), t + .1, Math.min(1.2, d * .5));
        },
        split(tl, el, t, d) {
          tl.fromTo(el.querySelector(".sp-l"), { x: -500 }, { x: 0, duration: .45, ease: "power3.out" }, t);
          tl.fromTo(el.querySelector(".sp-r"), { x: 500 }, { x: 0, duration: .45, ease: "power3.out" }, t + .15);
          tl.fromTo(el.querySelector(".sp-vs"), { scale: 0 }, { scale: 1, duration: .3, ease: "back.out(3)", immediateRender: true }, t + .5);
          tl.fromTo(el.querySelectorAll(".sp-p"), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: .18, immediateRender: true }, t + .7);
          tl.to(el.querySelectorAll(".sp-papers i"), { rotation: (j) => [-25, 15, 35][j], x: (j) => [-90, 40, 120][j], y: (j) => [-40, -90, -20][j], duration: .6, ease: "power2.out" }, t + .9);
          tl.fromTo(el.querySelector(".sp-check"), { scale: 0 }, { scale: 1, duration: .35, ease: "back.out(3)", immediateRender: true }, t + 1.2);
        },
        flow(tl, el, t, d) {
          const steps = el.querySelectorAll(".fl-step"), arrows = el.querySelectorAll(".fl-arrow i");
          const step = Math.min(.7, (d - .6) / Math.max(1, steps.length));
          steps.forEach((s, j) => {
            tl.fromTo(s, { x: j % 2 ? 300 : -300, opacity: 0 }, { x: 0, opacity: 1, duration: .35, ease: "power3.out", immediateRender: true }, t + .2 + j * step);
            if (arrows[j]) tl.fromTo(arrows[j], { scaleY: 0 }, { scaleY: 1, duration: .25, immediateRender: true }, t + .2 + j * step + .3);
            tl.to(s, { borderColor: "#ffd84d", duration: .2 }, t + .2 + j * step + .2);
          });
        },
      };`;
