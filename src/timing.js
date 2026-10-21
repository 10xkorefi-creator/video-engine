// Turns script beats + word timestamps into a timeline: beat windows, caption chunks, shots.

const untag = (s) => String(s).replace(/\[[^\]]*\]\s*/g, "");
const normTok = (s) => untag(s).toLowerCase().replace(/[^\p{L}\p{M}\p{N}₹%]/gu, "");
const chars = (s) => untag(s).replace(/[^\p{L}\p{M}\p{N}₹%]/gu, "").length;

/**
 * Locate each beat's first spoken word inside the transcript.
 * Uses character-proportion estimates, refined by matching the beat's first token nearby.
 */
export function beatStartIndices(beats, words) {
  const beatChars = beats.map((b) => chars(b.text));
  const totalScript = beatChars.reduce((a, b) => a + b, 0);
  const wordCum = [];
  let acc = 0;
  for (const w of words) { wordCum.push(acc); acc += chars(w.text); }
  const totalWords = acc;

  const idx = [0];
  let cum = 0;
  for (let i = 1; i < beats.length; i++) {
    cum += beatChars[i - 1];
    const target = (cum / totalScript) * totalWords;
    let est = wordCum.findIndex((c) => c >= target - 0.5);
    if (est < 0) est = words.length - 1;
    const first = normTok(untag(beats[i].text).split(/\s+/)[0] || "");
    let best = est;
    for (let d = 0; d <= 3 && first; d++) {
      if (normTok(words[est + d]?.text || "") === first) { best = est + d; break; }
      if (normTok(words[est - d]?.text || "") === first) { best = est - d; break; }
    }
    idx.push(Math.max(idx[i - 1] + 1, Math.min(best, words.length - 1)));
  }
  return idx;
}

/**
 * Optionally inserts a dramatic pause before the twist: everything from that word on
 * is shifted by `pause` seconds (the voice is split into two audio clips at render).
 */
export function buildTimeline(script, words, { audioDuration, pause = 0.35, lead = 0.1, tail = 0.9 }) {
  const beats = script.beats;
  const starts = beatStartIndices(beats, words);
  const twistBeat = beats.findIndex((b) => b.role === "twist");
  const splitWord = twistBeat > 0 ? starts[twistBeat] : -1;
  const splitAt = splitWord > 0 ? (words[splitWord - 1].end + words[splitWord].start) / 2 : null;
  const shift = (t) => lead + t + (splitAt != null && t >= splitAt ? pause : 0);

  const W = words.map((w) => ({ text: w.text, cap: w.cap ?? w.text, start: shift(w.start), end: shift(w.end) }));
  const total = shift(audioDuration) + tail;

  // Beat windows: each beat owns the screen from its first word until the next beat starts.
  const beatWin = beats.map((b, i) => ({
    ...b,
    start: i === 0 ? 0 : W[starts[i]].start - 0.08,
    end: i + 1 < beats.length ? W[starts[i + 1]].start - 0.08 : total,
  }));

  // Shots: long footage beats are split so a clip never runs past ~5.5s (calm pacing).
  const shots = [];
  beatWin.forEach((b, bi) => {
    const len = b.end - b.start;
    const isFootage = b.visual?.type === "footage";
    // Same scene on consecutive beats = one continuous animation.
    const prev = shots[shots.length - 1];
    if (b.visual?.type === "scene" && prev?.visual?.type === "scene" && JSON.stringify(prev.visual) === JSON.stringify(b.visual)) {
      prev.end = b.end;
      return;
    }
    // The paper canvas builds up over consecutive beats: keep one sheet, use the fullest version.
    if (b.visual?.scene === "paper_math" && prev?.visual?.scene === "paper_math") {
      const rows = (v) => (v.params?.rows || []).length + (v.params?.result ? 1 : 0);
      if (rows(b.visual) >= rows(prev.visual)) prev.visual = b.visual;
      prev.end = b.end;
      return;
    }
    const n = isFootage ? Math.max(1, Math.ceil(len / 5.5)) : 1;
    for (let k = 0; k < n; k++) {
      shots.push({
        beat: bi, part: k, role: b.role, visual: b.visual, beatText: b.text,
        start: b.start + (len * k) / n, end: b.start + (len * (k + 1)) / n,
      });
    }
  });

  // Captions: 1-3 words per chunk, break on punctuation or pauses.
  const kw = new Set(beats.flatMap((b) => (b.keywords || []).flatMap((k) => k.split(/\s+/).map(normTok))).filter(Boolean));
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) chunks.push(cur); cur = []; };
  W.forEach((w, i) => {
    const t = normTok(w.text);
    cur.push({ text: w.cap, start: w.start, end: w.end, hot: /\d|₹/.test(w.text) || kw.has(t) || kw.has(normTok(w.cap)) });
    const next = W[i + 1];
    const len = cur.map((x) => x.text).join(" ").length;
    if (/[.,!?;:।]$/.test(w.text) || !next || next.start - w.end > 0.28 || cur.length >= 3 || len > 14) flush();
  });
  // No captions over the CTA end card (it already shows the URL).
  const ctaStart = beatWin.find((b) => b.role === "cta")?.start ?? Infinity;
  const kept = chunks.filter((c) => c[0].start < ctaStart - 0.05);
  chunks.length = 0;
  chunks.push(...kept);
  const captions = chunks.map((c, i) => ({
    words: c,
    start: c[0].start,
    end: Math.min(c[c.length - 1].end + 0.25, chunks[i + 1]?.[0].start ?? total),
  }));

  return {
    total,
    lead,
    voice: splitAt == null
      ? [{ start: lead, mediaStart: 0, duration: audioDuration }]
      : [
          { start: lead, mediaStart: 0, duration: splitAt },
          { start: lead + splitAt + pause, mediaStart: splitAt, duration: audioDuration - splitAt },
        ],
    twistAt: splitAt == null ? null : lead + splitAt + pause,
    beats: beatWin,
    shots,
    captions,
    hookEnd: beatWin[1]?.start ?? total,
  };
}
