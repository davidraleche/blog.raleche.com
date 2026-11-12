#!/usr/bin/env node
// Render a book's 5-second share video (vertical 9:16 and wide 16:9): the book cover,
// who recommends it and what they said, then "Get the book at raleche.com".
// Each layer is drawn as HTML by headless Chrome (transparent PNG), then ffmpeg animates them.
//
//   node scripts/make-book-video.mjs <book.json> <out dir>
//
// book.json: { slug, title, subtitle?, author, who, relation?, note }
// Writes <out dir>/<slug>-vertical.mp4 and <slug>-wide.mp4 (upload them with scripts/publish-book-videos.mjs).
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const [bookFile, out] = process.argv.slice(2);
if (!bookFile || !out) {
  console.error("usage: node scripts/make-book-video.mjs <book.json> <out dir>");
  process.exit(1);
}
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const book = JSON.parse(readFileSync(bookFile, "utf8"));
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "book-video-"));
const SECONDS = 5;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const [main, sub] = book.subtitle ? [book.title, book.subtitle] : book.title.split(/:\s*(.*)/s);
const relation = { recommends: "Recommended by", reading: "Read by", influenced: "Shaped", wrote: "Written by" }[book.relation ?? "recommends"] ?? "Recommended by";
const note = book.note.replace(/^["“]|["”]$/g, "");

// Layers, in order, with when each comes in (seconds). The cover also rises into place.
const LAYERS = ["bg", "cover", "who", "quote", "cta"];
const FROM = { cover: 0, who: 0.6, quote: 1.4, cta: 2.8 };

function html(format, layer) {
  const v = format === "vertical";
  const [W, H] = v ? [1080, 1920] : [1920, 1080];
  const show = (name) => (name === layer ? "" : "visibility:hidden;");
  const cover = v ? { w: 560, h: 840, x: 260, y: 230 } : { w: 480, h: 720, x: 150, y: 180 };
  const text = v ? { x: 80, y: 1140, w: 920 } : { x: 760, y: 200, w: 1010 };
  const cta = v ? { x: 80, y: 1650, w: 920, h: 150 } : { x: 760, y: 820, w: 1010, h: 140 };
  const titleSize = main.length > 14 ? 96 : 150;
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
  .abs{position:absolute}
  .hed{font-family:"DIN Condensed","Arial Narrow",sans-serif;font-weight:700;text-transform:uppercase;line-height:.9}
  .sans{font-family:Arial,Helvetica,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.18em}
  </style><body>
  <div class="abs" style="${show("bg")}inset:0;background:#17120f">
    <div class="abs sans" style="left:${v ? 80 : 760}px;top:${v ? 110 : 120}px;font-size:28px;color:#f5a623">Raleche · Books</div>
  </div>
  <div class="abs" style="${show("cover")}left:${cover.x}px;top:${cover.y}px;width:${cover.w}px;height:${cover.h}px;background:#0f3d44;border-top:${cover.w * 0.04}px solid #f5a623;box-shadow:24px 24px 0 #000;padding:${cover.w * 0.09}px">
    <div style="width:${cover.w * 0.2}px;height:8px;background:#f5a623"></div>
    <div class="hed" style="margin-top:${cover.w * 0.07}px;font-size:${titleSize * cover.w / 560}px;color:#fff">${esc(main)}</div>
    ${sub ? `<div class="sans" style="margin-top:${cover.w * 0.05}px;font-size:${30 * cover.w / 560}px;line-height:1.35;letter-spacing:.08em;color:rgba(255,255,255,.85)">${esc(sub)}</div>` : ""}
    <div class="abs sans" style="left:${cover.w * 0.09}px;bottom:${cover.w * 0.09}px;font-size:${28 * cover.w / 560}px;letter-spacing:.12em;color:#f5a623">${esc(book.author)}</div>
  </div>
  <div class="abs" style="${show("who")}left:${text.x}px;top:${text.y}px;width:${text.w}px">
    <div class="sans" style="font-size:${v ? 32 : 30}px;color:#f5a623">${esc(relation)}</div>
    <div class="hed" style="margin-top:20px;font-size:${v ? 140 : 130}px;color:#fff">${esc(book.who)}</div>
  </div>
  <div class="abs" style="${show("quote")}left:${text.x}px;top:${text.y + (v ? 205 : 195)}px;width:${text.w}px;font-family:Georgia,serif;font-style:italic;font-size:${v ? 46 : 44}px;line-height:1.35;color:rgba(255,255,255,.92);border-left:6px solid #f5a623;padding-left:28px">“${esc(note)}”</div>
  <div class="abs" style="${show("cta")}left:${cta.x}px;top:${cta.y}px;width:${cta.w}px">
    <div class="hed" style="height:${cta.h}px;background:#f5a623;color:#17120f;display:flex;align-items:center;justify-content:center;font-size:${v ? 76 : 72}px;padding-top:10px;box-shadow:10px 10px 0 #000">Get the book at raleche.com</div>
    <div class="sans" style="margin-top:28px;text-align:center;font-size:24px;letter-spacing:.12em;color:rgba(255,255,255,.6)">${esc(main)} · ${esc(book.author)}</div>
  </div>
  </body>`;
}

function shoot(format, layer) {
  const [W, H] = format === "vertical" ? [1080, 1920] : [1920, 1080];
  const page = join(tmp, `${format}-${layer}.html`), png = join(tmp, `${format}-${layer}.png`);
  writeFileSync(page, html(format, layer));
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${W},${H}`, "--default-background-color=00000000", `--screenshot=${png}`, `file://${page}`], { stdio: "ignore" });
  return png;
}

function render(format) {
  const pngs = LAYERS.map((l) => shoot(format, l));
  const inputs = pngs.flatMap((p) => ["-loop", "1", "-t", String(SECONDS), "-framerate", "30", "-i", p]);
  const a = LAYERS.length; // the silent audio track comes after the images
  const f = [`[0:v]format=yuv420p[base0]`];
  LAYERS.slice(1).forEach((l, i) => {
    const n = i + 1, from = FROM[l];
    f.push(`[${n}:v]format=rgba,fade=in:st=${from}:d=${l === "cta" ? 0.15 : 0.45}:alpha=1[l${n}]`);
    const y = l === "cover" ? `'max(0,90*(1-t/0.6))'` : "0";
    f.push(`[base${i}][l${n}]overlay=x=0:y=${y}:format=auto${n === a - 1 ? "" : `[base${n}]`}`);
  });
  f[f.length - 1] += ",format=yuv420p[v]";
  const file = join(out, `${book.slug}-${format}.mp4`);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", ...inputs, "-f", "lavfi", "-t", String(SECONDS), "-i", "anullsrc=r=44100:cl=stereo",
    "-filter_complex", f.join(";"), "-map", "[v]", "-map", `${a}:a`, "-t", String(SECONDS),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-r", "30",
    "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", file,
  ], { stdio: "inherit" });
  console.log("wrote", file);
}
render("vertical");
render("wide");
