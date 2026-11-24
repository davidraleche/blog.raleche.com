// Text layout and recording helpers for the share videos drawn in the browser
// (components/QuestionShareVideo.tsx, lib/story-clip.ts).

/** Break text into lines that fit maxW: words for Latin scripts, single characters for Chinese (and words too long for a line). */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const units = text.match(/[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+\s*|\s+/g) ?? [];
  const lines: string[] = [];
  let line = "";
  for (const u of units) {
    if (ctx.measureText((line + u).trimEnd()).width <= maxW) { line += u; continue; }
    if (line.trim()) lines.push(line.trimEnd());
    line = "";
    if (ctx.measureText(u.trimEnd()).width <= maxW) { line = u.trimStart(); continue; }
    for (const ch of u) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ""; }
      line += ch;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** The largest font size (from start down to min) at which the text fits the box; past min, the last line ends in "…". */
export function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, start: number, min: number, lh = 1.2) {
  for (let px = start; ; px -= 2) {
    ctx.font = font(px);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines, lh };
    if (px <= min) {
      const keep = Math.max(1, Math.floor(maxH / (px * lh)));
      const cut = lines.slice(0, keep);
      cut[keep - 1] = cut[keep - 1].replace(/\s*\S{0,3}$/, "") + "…";
      return { px, lines: cut, lh };
    }
  }
}

/** The best video type this browser can record, or null when it can't record a canvas. */
export function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/** Record an animation in real time (len seconds) from a canvas of w×h into a video file. */
export async function recordCanvas(w: number, h: number, len: number, draw: (ctx: CanvasRenderingContext2D, t: number) => void, onProgress: (s: number) => void): Promise<Blob | null> {
  const mime = pickMime();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!mime || !ctx || !canvas.captureStream) return null;
  draw(ctx, 0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      draw(ctx, Math.min(t, len));
      onProgress(Math.max(0, Math.ceil(len - t)));
      if (t >= len) res();
      // rAF pauses in background tabs: a timer keeps the clip going (at a lower frame rate) if the reader switches tabs.
      else if (document.hidden) setTimeout(tick, 33);
      else requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  await done;
  return new Blob(chunks, { type: mime.split(";")[0] });
}
