"use client";
import { useEffect, useRef, useState } from "react";
import { PLATFORMS, UPLOAD_URL, copyText, type Platform } from "./StoryShareVideo";

/** Video size (vertical 9:16) and length in seconds. */
const W = 720;
const H = 1280;
const LEN = 9;
const INK = "#0a0a0a";
const AMBER = "#f5a623";

export type QuestionShare = {
  /** The game page, e.g. https://raleche.com/vocabulary (the question's ?q= is added here). */
  url: string;
  /** "What does it mean?" / "Who said it?" */
  title: string;
  labels: Record<string, string>;
  /** The signed-in reader's share code: their links carry &by=<code> and earn them tokens. */
  shareCode?: string | null;
  signinHref?: string;
};

type Q = { kind: "vocab" | "quote"; prompt: string; hint: string; options: string[]; ref: string };
type Fonts = { display: string; serif: string; mono: string };

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x: number) => { const c = 1.9; const p = clamp(x) - 1; return 1 + (c + 1) * p * p * p + c * p * p; };

/** Break text into lines that fit maxW: words for Latin scripts, single characters for Chinese (and words too long for a line). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const units = text.match(/[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+\s*|\s+/g) ?? [];
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
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, start: number, min: number, lh = 1.2) {
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

/** Draw the frame at time t (seconds): question, then A-D one by one, then "Go play at raleche.com". Never shows the answer. */
function drawFrame(ctx: CanvasRenderingContext2D, t: number, q: Q, share: QuestionShare, f: Fonts) {
  const L = share.labels;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header: black band, RALECHE + the game's name in amber.
  const hy = -120 * (1 - easeOut(t / 0.45));
  ctx.fillStyle = INK;
  ctx.fillRect(0, hy, W, 120);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${f.display}`;
  ctx.textAlign = "left";
  ctx.fillText("RALECHE", 40, hy + 78);
  ctx.fillStyle = AMBER;
  ctx.textAlign = "right";
  const title = share.title.toUpperCase();
  let tp = 38;
  do { ctx.font = `700 ${tp}px ${f.display}`; tp -= 2; } while (ctx.measureText(title).width > 420 && tp > 18);
  ctx.fillText(title, W - 40, hy + 76);

  // The word or the quote.
  const vocab = q.kind === "vocab";
  const PH = vocab ? 260 : 400;
  const py = 160;
  const pa = easeOut((t - 0.2) / 0.5);
  ctx.globalAlpha = pa;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  if (vocab) {
    let top = py;
    if (q.hint) {
      ctx.font = `700 22px ${f.mono}`;
      ctx.fillStyle = "rgba(10,10,10,0.6)";
      ctx.fillText(q.hint.toUpperCase(), 40, top + 22);
      ctx.fillStyle = INK;
      top += 40;
    }
    const r = fit(ctx, q.prompt.toUpperCase(), (px) => `800 ${px}px ${f.display}`, W - 80, PH - (top - py), 170, 44, 0.95);
    ctx.font = `800 ${r.px}px ${f.display}`;
    const blockH = r.lines.length * r.px * r.lh;
    const y0 = top + (PH - (top - py) - blockH) / 2 + r.px * 0.85 + (1 - pa) * 30;
    r.lines.forEach((l, i) => ctx.fillText(l, 40, y0 + i * r.px * r.lh));
  } else {
    const r = fit(ctx, `“${q.prompt}”`, (px) => `700 ${px}px ${f.display}`, W - 80, PH, 72, 26, 1.15);
    ctx.font = `700 ${r.px}px ${f.display}`;
    const blockH = r.lines.length * r.px * r.lh;
    const y0 = py + (PH - blockH) / 2 + r.px * 0.85 + (1 - pa) * 30;
    r.lines.forEach((l, i) => ctx.fillText(l, 40, y0 + i * r.px * r.lh));
  }
  ctx.globalAlpha = 1;

  // Amber "Can you guess?" strip, wiping in from the left.
  const sy = py + PH + 20;
  const sw = W * easeOut((t - 0.9) / 0.35);
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, sy, sw, 64);
  ctx.fillStyle = INK;
  ctx.fillRect(0, sy, sw, 5);
  ctx.fillRect(0, sy + 59, sw, 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, sy, sw, 64);
  ctx.clip();
  ctx.font = `700 26px ${f.mono}`;
  ctx.textAlign = "left";
  ctx.fillText(`${L.wgVideoGuess.toUpperCase()}  A · B · C · D`, 40, sy + 42);
  ctx.restore();

  // The four choices, one by one, as the site's answer buttons: black border, hard shadow, amber lettered badge.
  const top = sy + 64 + 34;
  const bottom = H - 110;
  const gap = 24;
  const bh = (bottom - top - gap * 3) / 4;
  const bw = W - 80 - 10;
  q.options.forEach((o, i) => {
    const start = 1.5 + i * 0.8;
    const p = easeOut((t - start) / 0.45);
    if (p <= 0) return;
    const x = 40 + (1 - p) * 90;
    const y = top + i * (bh + gap);
    ctx.globalAlpha = p;
    ctx.fillStyle = INK;
    ctx.fillRect(x + 10, y + 10, bw, bh);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, bw, bh);
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeRect(x + 3, y + 3, bw - 6, bh - 6);
    // Badge: pops in, then each one pulses in turn while the viewer thinks.
    const cx = x + 56;
    const cy = y + bh / 2;
    const k = (t - 5) / 0.4 - i;
    const pulse = k >= 0 && k <= 1 ? Math.sin(k * Math.PI) : 0;
    const s = easeBack((t - start) / 0.5) * (1 + 0.14 * pulse);
    ctx.beginPath();
    ctx.arc(cx, cy, 31 * s, 0, Math.PI * 2);
    ctx.fillStyle = pulse > 0.3 ? INK : AMBER;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = pulse > 0.3 ? "#ffffff" : INK;
    ctx.font = `700 ${Math.round(30 * s)}px ${f.mono}`;
    ctx.textAlign = "center";
    ctx.fillText("ABCD"[i], cx, cy + 10 * s);
    // The choice's text.
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    const tw = bw - 110 - 24;
    const r = vocab
      ? fit(ctx, o, (px) => `400 ${px}px ${f.serif}`, tw, bh - 28, 30, 17, 1.22)
      : fit(ctx, o, (px) => `700 ${px}px ${f.display}`, tw, bh - 24, 44, 22, 1.05);
    ctx.font = vocab ? `400 ${r.px}px ${f.serif}` : `700 ${r.px}px ${f.display}`;
    const blockH = r.lines.length * r.px * r.lh;
    const ty = cy - blockH / 2 + r.px * 0.82;
    r.lines.forEach((l, j) => ctx.fillText(l, x + 110, ty + j * r.px * r.lh));
    ctx.globalAlpha = 1;
  });

  // Footer.
  ctx.fillStyle = "rgba(10,10,10,0.5)";
  ctx.font = `700 22px ${f.mono}`;
  ctx.textAlign = "center";
  ctx.fillText("RALECHE.COM", W / 2, H - 52);

  // End frame: amber wipes up from the bottom, then "Go play at raleche.com" and the link.
  const e = easeOut((t - 6.6) / 0.45);
  if (e > 0) {
    ctx.fillStyle = AMBER;
    ctx.fillRect(0, H * (1 - e), W, H * e);
    ctx.fillStyle = INK;
    ctx.fillRect(0, H * (1 - e) - 8, W, 8);
  }
  const c = easeOut((t - 7.0) / 0.4);
  if (c > 0) {
    ctx.globalAlpha = c;
    const lift = (1 - c) * 40;
    ctx.fillStyle = INK;
    ctx.lineWidth = 12;
    ctx.strokeStyle = INK;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.textAlign = "center";
    ctx.font = `800 40px ${f.display}`;
    ctx.fillText(share.title.toUpperCase(), W / 2, 330 + lift);
    let cp = 96;
    const cta = L.wgVideoCta.toUpperCase();
    do { ctx.font = `800 ${cp}px ${f.display}`; cp -= 4; } while (ctx.measureText(cta).width > W - 120 && cp > 40);
    ctx.fillText(cta, W / 2, 560 + lift);
    // raleche.com in a black box, like the site's dark buttons.
    let dp = 128;
    do { ctx.font = `800 ${dp}px ${f.display}`; dp -= 4; } while (ctx.measureText("RALECHE.COM").width > W - 160 && dp > 40);
    const bx = 60;
    const by = 610 + lift;
    ctx.fillRect(bx + 12, by + 12, W - 120, 170);
    ctx.fillRect(bx, by, W - 120, 170);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("RALECHE.COM", W / 2, by + 85 + dp * 0.36);
    // The page path and a nudge: the answer is behind the link.
    ctx.fillStyle = INK;
    ctx.font = `700 28px ${f.mono}`;
    const path = share.url.replace(/^https?:\/\//, "");
    ctx.fillText(`${path} ▸`, W / 2, 880 + lift);
    const r = fit(ctx, L.wgVideoAnswer, (px) => `italic 400 ${px}px ${f.serif}`, W - 160, 120, 36, 22, 1.25);
    ctx.font = `italic 400 ${r.px}px ${f.serif}`;
    r.lines.forEach((l, i) => ctx.fillText(l, W / 2, 970 + lift + i * r.px * r.lh));
    // Four empty badges: the choices are waiting.
    "ABCD".split("").forEach((ch, i) => {
      const bxx = W / 2 + (i - 1.5) * 100;
      const pop = easeBack((t - 7.3 - i * 0.12) / 0.4);
      if (pop <= 0) return;
      ctx.beginPath();
      ctx.arc(bxx, 1120 + lift, 34 * pop, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = `700 ${Math.round(32 * pop)}px ${f.mono}`;
      ctx.fillText(ch, bxx, 1131 + lift);
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/** Record the animation in real time (LEN seconds) into a video file. */
async function recordVideo(q: Q, share: QuestionShare, fonts: Fonts, onProgress: (s: number) => void): Promise<Blob | null> {
  const mime = pickMime();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!mime || !ctx || !canvas.captureStream) return null;
  drawFrame(ctx, 0, q, share, fonts);
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
      drawFrame(ctx, Math.min(t, LEN), q, share, fonts);
      onProgress(Math.max(0, Math.ceil(LEN - t)));
      if (t >= LEN) res();
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

/** "Share this question as a mini video": a 9-second vertical clip of the question and its choices (no answer), made in the browser. */
export function QuestionShareVideo({ q, share }: { q: Q; share: QuestionShare }) {
  const L = share.labels;
  const box = useRef<HTMLElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const probes = useRef<HTMLDivElement>(null);
  const fonts = useRef<Fonts | null>(null);
  const making = useRef<Promise<File | null> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [copied, setCopied] = useState<"caption" | "link" | null>(null);
  const [tip, setTip] = useState<{ kind: "intent" | "upload" | "error" | "ready"; platform: Platform } | null>(null);

  const slug = (q.kind === "vocab" ? q.prompt : q.options.join(" ")).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "question";
  const base = q.kind === "vocab" ? "vocabulary" : "who-said-it";
  const linkFor = (source: string) => `${share.url}?q=${encodeURIComponent(q.ref)}&source=${source}${share.shareCode ? `&by=${share.shareCode}` : ""}`;
  const captionFor = (source: string) => fill(L.wgVideoCaption, { title: share.title, link: linkFor(source) });
  const caption = captionFor("share");
  const shortText = `${share.title} ${q.kind === "vocab" ? q.prompt : `“${q.prompt.slice(0, 160)}”`} ${L.wgVideoGuess} A, B, C, D`;

  const getFonts = () => {
    if (fonts.current) return fonts.current;
    const fam = (cls: string) => (probes.current?.querySelector(`.${cls}`) ? getComputedStyle(probes.current.querySelector(`.${cls}`)!).fontFamily : "sans-serif");
    fonts.current = { display: fam("font-display"), serif: fam("font-serif"), mono: fam("font-mono") };
    return fonts.current;
  };
  const loadFonts = async () => {
    const f = getFonts();
    await Promise.all([`800 40px ${f.display}`, `700 40px ${f.display}`, `400 30px ${f.serif}`, `italic 400 30px ${f.serif}`, `700 26px ${f.mono}`].map((s) => document.fonts?.load(s).catch(() => null)));
    return f;
  };

  /** Make the video once (in real time, ~9 s); later calls get the same file. */
  const makeFile = () =>
    (making.current ||= (async () => {
      const f = await loadFonts();
      const blob = await recordVideo(q, share, f, setLeft).catch(() => null);
      setLeft(null);
      if (!blob || !blob.size) {
        setUnsupported(true);
        return null;
      }
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const made = new File([blob], `raleche-${base}-${slug}.${ext}`, { type: blob.type });
      setFile(made);
      setVideoUrl(URL.createObjectURL(made));
      return made;
    })());

  useEffect(() => {
    try {
      const probe = new File([new Blob([""], { type: "video/mp4" })], "probe.mp4", { type: "video/mp4" });
      if (navigator.canShare?.({ files: [probe] })) setCanShareFiles(true);
    } catch {}
    if (!pickMime()) setUnsupported(true);
  }, []);

  // Live preview: the same animation, looping, while the panel is on screen. Once the panel is in view, make the file too,
  // so Download and Share are instant (and phones' share sheet opens on the tap itself).
  useEffect(() => {
    if (!box.current || !preview.current) return;
    const ctx = preview.current.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let visible = false;
    let t0 = performance.now();
    let ready = false;
    loadFonts().then(() => { ready = true; t0 = performance.now(); });
    const loop = () => {
      if (ready) drawFrame(ctx, ((performance.now() - t0) / 1000) % (LEN + 0.6), q, share, getFonts());
      if (visible) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver((entries) => {
      const now = entries.some((e) => e.isIntersecting);
      if (now && !visible) { visible = true; raf = requestAnimationFrame(loop); if (pickMime()) makeFile(); }
      if (!now) { visible = false; cancelAnimationFrame(raf); }
    }, { rootMargin: "100px" });
    io.observe(box.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const flash = (what: "caption" | "link") => {
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
  };

  const saveFile = (f: File) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  const download = async () => {
    const f = file ?? (await makeFile());
    if (f) saveFile(f);
  };

  /** Share the file with the phone's share sheet. "later" when the file wasn't ready in time for this tap. */
  const shareFile = async (text = caption): Promise<boolean | "later"> => {
    if (!canShareFiles) return false;
    const f = file ?? (await makeFile());
    if (!f || !navigator.canShare?.({ files: [f] })) return false;
    try {
      await navigator.share({ files: [f], text, title: share.title });
    } catch (e) {
      const name = (e as Error)?.name;
      // The tap "expired" while the video was being made: one more tap shares it.
      if (name === "NotAllowedError") return "later";
      if (name !== "AbortError") return false;
    }
    return true;
  };

  const onPlatform = async (p: (typeof PLATFORMS)[number]) => {
    const source = p.id === "x" ? "twitter" : p.id;
    const link = encodeURIComponent(linkFor(source));
    const platformCaption = captionFor(source);
    const intent =
      p.id === "x" ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText.slice(0, 230))}&url=${link}`
      : p.id === "linkedin" ? `https://www.linkedin.com/sharing/share-offsite/?url=${link}`
      : p.id === "facebook" ? `https://www.facebook.com/sharer/sharer.php?u=${link}`
      : null;
    if (intent) {
      window.open(intent, "_blank", "noopener,noreferrer,width=640,height=640");
      copyText(platformCaption);
      setTip({ kind: "intent", platform: p.id });
      return;
    }
    copyText(platformCaption);
    const shared = await shareFile(platformCaption);
    if (shared === true) { setTip(null); return; }
    if (shared === "later") { setTip({ kind: "ready", platform: p.id }); return; }
    await download();
    setTip({ kind: "upload", platform: p.id });
  };

  const onShare = async () => {
    copyText(caption);
    const shared = await shareFile();
    if (shared === "later") setTip({ kind: "ready", platform: "x" });
    else if (!shared) setTip({ kind: "error", platform: "x" });
  };

  const platformName = (id: Platform) => PLATFORMS.find((p) => p.id === id)!.name;
  const busy = left !== null;

  return (
    <section ref={box} id="share-question" className="relative mt-10 scroll-mt-24 border-[3px] border-ink">
      <div ref={probes} aria-hidden className="invisible absolute h-0 w-0 overflow-hidden">
        <span className="font-display">a</span><span className="font-serif">a</span><span className="font-mono">a</span>
      </div>
      <div className="flex items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{L.wgVideoTitle}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{L.wgVideoBadge}</span>
      </div>
      <div className="grid gap-6 px-5 py-5 sm:grid-cols-[240px_1fr] sm:px-8">
        <div className="flex justify-center bg-ink/5 p-3 sm:self-start">
          {videoUrl ? (
            <video key={videoUrl} src={videoUrl} controls muted loop autoPlay playsInline className="aspect-[9/16] w-full max-w-[220px] border-2 border-ink bg-ink" />
          ) : (
            <canvas ref={preview} width={W} height={H} className="aspect-[9/16] w-full max-w-[220px] border-2 border-ink bg-white" />
          )}
        </div>
        <div>
          <p className="font-serif text-ink/80">{L.wgVideoDek}</p>
          {share.shareCode ? (
            <p className="mt-3 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest">★ {L.shareVideoEarn}</p>
          ) : share.signinHref ? (
            <p className="mt-3 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest">
              ★ {L.shareVideoEarnSignIn} <a href={share.signinHref} className="text-accent underline">{L.shareVideoSignIn}</a>
            </p>
          ) : null}
          {busy && <p role="status" className="mt-3 font-mono text-[11px] font-bold uppercase tracking-widest text-ink/60">● {fill(L.wgVideoMaking, { s: left! })}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {!unsupported && (
              <button type="button" onClick={download} disabled={busy && !file} className="btn-dark disabled:opacity-60">⬇ {L.shareVideoDownload}</button>
            )}
            {canShareFiles && !unsupported && <button type="button" onClick={onShare} className="btn-dark">↗ {L.shareVideoShare}</button>}
            <button type="button" onClick={() => copyText(caption).then((ok) => ok && flash("caption"))} className="btn-light">
              {copied === "caption" ? `✓ ${L.shareVideoCopied}` : L.shareVideoCopyCaption}
            </button>
            <button type="button" onClick={() => copyText(linkFor("link")).then((ok) => ok && flash("link"))} className="btn-light">
              {copied === "link" ? `✓ ${L.shareVideoCopied}` : L.shareVideoCopyLink}
            </button>
          </div>

          <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{L.shareVideoOn}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLATFORMS.filter((p) => !unsupported || UPLOAD_URL[p.id] === undefined).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPlatform(p)}
                className="flex items-center gap-2 border-2 border-ink bg-white px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-ink shadow-[3px_3px_0_#111] transition hover:bg-ink hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>

          {tip && (
            <div role="status" className="mt-4 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-4 py-3 font-serif text-sm">
              {tip.kind === "intent" && <p>{fill(L.shareVideoIntentTip, { platform: platformName(tip.platform) })}</p>}
              {tip.kind === "error" && <p>{L.shareVideoShareFailed}</p>}
              {tip.kind === "ready" && <p className="font-mono text-[11px] font-bold uppercase tracking-widest">✓ {L.wgVideoReady}</p>}
              {tip.kind === "upload" && (
                <>
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">{fill(L.shareVideoUploadTitle, { platform: platformName(tip.platform) })}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    <li>{L.shareVideoStep1}</li>
                    <li>{L.shareVideoStep2}</li>
                    <li>{fill(L.shareVideoStep3, { platform: platformName(tip.platform) })}</li>
                  </ol>
                  <a href={UPLOAD_URL[tip.platform]} target="_blank" rel="noopener noreferrer" className="btn-dark mt-3">
                    {fill(L.shareVideoOpen, { platform: platformName(tip.platform) })} ↗
                  </a>
                </>
              )}
            </div>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-ink/60 hover:text-ink">{L.shareVideoSeeCaption}</summary>
            <p className="mt-2 whitespace-pre-line break-words border border-ink/15 bg-ink/[0.03] p-3 font-serif text-sm text-ink/80">{caption}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
