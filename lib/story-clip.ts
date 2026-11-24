// An 8-second share clip of any story, drawn in the reader's browser (vertical 9:16 or wide 16:9), for stories
// without a made-in-advance mini video (lib/story-videos.ts). Every frame carries "RALECHE.COM" in the top bar.
import { fit, recordCanvas } from "./canvas-text";

export type ClipFormat = "vertical" | "wide";
export type StoryClip = {
  title: string;
  /** The summary line under the title (optional). */
  dek: string;
  /** Small amber line above the title: the category or the speaker. */
  kicker: string;
  /** Same-origin cover URL (through /_next/image), so the canvas can be recorded. */
  cover: string | null;
  /** "Read the full story at" */
  readAt: string;
};
export type ClipFonts = { display: string; serif: string; mono: string };

export const CLIP_LEN = 8;
export const CLIP_SIZE: Record<ClipFormat, [number, number]> = { vertical: [720, 1280], wide: [1280, 720] };

const INK = "#0a0a0a";
const AMBER = "#f5a623";
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

/** The cover through raleche.com's resizer: same origin, so drawing it doesn't block recording, and small. */
export function clipCoverUrl(src: string | null | undefined) {
  if (!src) return null;
  if (!src.startsWith("/") && !/^https:\/\//.test(src)) return null;
  return `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`;
}

export function loadClipImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** The top bar on every frame: the RALECHE letter boxes and raleche.com. */
function topBar(ctx: CanvasRenderingContext2D, W: number, f: ClipFonts, wide: boolean) {
  const hb = wide ? 72 : 96;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, hb);
  ctx.fillStyle = INK;
  ctx.fillRect(0, hb - 4, W, 4);
  // Logo: alternating black and white letter boxes, like the site's header.
  const box = wide ? 40 : 50;
  const y = (hb - 4 - box) / 2;
  let x = wide ? 40 : 32;
  ctx.font = `800 ${Math.round(box * 0.62)}px ${f.display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [..."RALECHE"].forEach((ch, i) => {
    const dark = i % 2 === 0;
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, box, box);
    if (!dark) { ctx.fillStyle = "#fff"; ctx.fillRect(x + 3, y + 3, box - 6, box - 6); }
    ctx.fillStyle = dark ? "#fff" : INK;
    ctx.fillText(ch, x + box / 2, y + box / 2 + 2);
    x += box;
  });
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.font = `700 ${wide ? 26 : 24}px ${f.mono}`;
  ctx.fillText("RALECHE.COM", W - (wide ? 40 : 32), (hb - 4) / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return hb;
}

/** Draw the clip at time t (seconds): cover + title, then the summary, then "Read the full story at raleche.com". */
export function drawStoryClip(ctx: CanvasRenderingContext2D, t: number, format: ClipFormat, c: StoryClip, f: ClipFonts, img: HTMLImageElement | null) {
  const [W, H] = CLIP_SIZE[format];
  const wide = format === "wide";
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // Cover, slowly zooming in. Vertical: on top; wide: on the right.
  if (img) {
    const z = 1 + 0.06 * (t / CLIP_LEN);
    const [bx, by, bw, bh] = wide ? [W * 0.46, 0, W * 0.54, H] : [0, 0, W, H * 0.62];
    const s = Math.max(bw / img.width, bh / img.height) * z;
    const iw = img.width * s, ih = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    ctx.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
    ctx.restore();
    // Fade the photo into the text side: from the left edge in the wide clip, from the bottom in the vertical one.
    const g = wide ? ctx.createLinearGradient(W * 0.62, 0, W * 0.46, 0) : ctx.createLinearGradient(0, H * 0.36, 0, H * 0.62);
    g.addColorStop(0, "rgba(10,10,10,0)");
    g.addColorStop(1, INK);
    ctx.fillStyle = g;
    if (wide) ctx.fillRect(W * 0.46, 0, W * 0.16, H);
    else ctx.fillRect(0, H * 0.36, W, H * 0.26);
  }

  // Text area: bottom of the vertical clip, left of the wide one.
  const pad = wide ? 56 : 48;
  const tw = wide ? W * 0.46 - pad - 16 : W - pad * 2;
  const top = wide ? 130 : H * 0.5;
  const bottom = H - (wide ? 70 : 110);
  const hasDek = !!c.dek.trim();
  const tDek = hasDek ? 3.8 : 99;
  const tEnd = 6.4;

  // Kicker
  if (c.kicker) {
    ctx.globalAlpha = easeOut(t / 0.5);
    ctx.fillStyle = AMBER;
    ctx.font = `700 ${wide ? 22 : 24}px ${f.mono}`;
    ctx.fillText(c.kicker.toUpperCase().slice(0, 40), pad, top + 24);
    ctx.globalAlpha = 1;
  }
  const textTop = top + (c.kicker ? 50 : 0);

  // Title, sliding up; it moves out when the summary comes in.
  const tIn = easeOut((t - 0.2) / 0.7);
  const tOut = easeOut((t - tDek) / 0.5);
  if (tIn > 0 && tOut < 1) {
    const r = fit(ctx, c.title, (px) => `800 ${px}px ${f.display}`, tw, bottom - textTop, wide ? 64 : 72, 30, 1.08);
    ctx.globalAlpha = tIn * (1 - tOut);
    ctx.fillStyle = "#fff";
    const dy = (1 - tIn) * 40 - tOut * 40;
    r.lines.forEach((l, i) => ctx.fillText(l, pad, textTop + r.px + dy + i * r.px * r.lh));
    ctx.globalAlpha = 1;
  }
  // Summary, in serif with an amber rule.
  if (hasDek && t >= tDek) {
    const k = easeOut((t - tDek - 0.2) / 0.6);
    const r = fit(ctx, c.dek, (px) => `italic 400 ${px}px ${f.serif}`, tw - 24, bottom - textTop, wide ? 44 : 50, 24, 1.3);
    ctx.globalAlpha = k;
    ctx.fillStyle = AMBER;
    ctx.fillRect(pad, textTop + 6, 6, r.lines.length * r.px * r.lh);
    ctx.fillStyle = "#fff";
    r.lines.forEach((l, i) => ctx.fillText(l, pad + 24, textTop + r.px + (1 - k) * 30 + i * r.px * r.lh));
    ctx.globalAlpha = 1;
  }
  // Progress bar
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(pad, H - (wide ? 40 : 60), W - pad * 2, 4);
  ctx.fillStyle = AMBER;
  ctx.fillRect(pad, H - (wide ? 40 : 60), (W - pad * 2) * clamp(t / tEnd), 4);

  // End card: amber wipes up, then "Read the full story at" and raleche.com in a black box.
  if (t >= tEnd) {
    const w = easeOut((t - tEnd) / 0.45);
    ctx.fillStyle = AMBER;
    ctx.fillRect(0, H - H * w, W, H * w);
    const k = easeOut((t - tEnd - 0.3) / 0.5);
    ctx.globalAlpha = k;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    const r = fit(ctx, c.readAt, (px) => `800 ${px}px ${f.display}`, W - pad * 2, wide ? 120 : 200, wide ? 56 : 64, 28, 1.1);
    const cy = H / 2 - (wide ? 40 : 60);
    r.lines.forEach((l, i) => ctx.fillText(l, W / 2, cy - (r.lines.length - 1) * r.px * r.lh + i * r.px * r.lh));
    ctx.font = `800 ${wide ? 64 : 72}px ${f.display}`;
    const label = "RALECHE.COM";
    const bw = ctx.measureText(label).width + 64;
    const bh = wide ? 104 : 116;
    const by = cy + 40;
    ctx.fillRect(W / 2 - bw / 2, by, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, W / 2, by + bh / 2 + (wide ? 23 : 26));
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  topBar(ctx, W, f, wide);
  ctx.restore();
}

/** Record the clip in real time (8 s). */
export function recordStoryClip(format: ClipFormat, c: StoryClip, f: ClipFonts, img: HTMLImageElement | null, onProgress: (s: number) => void) {
  const [W, H] = CLIP_SIZE[format];
  return recordCanvas(W, H, CLIP_LEN, (ctx, t) => drawStoryClip(ctx, t, format, c, f, img), onProgress);
}
