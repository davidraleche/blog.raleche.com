"use client";
import { useEffect, useRef, useState } from "react";

type Format = "vertical" | "wide";
export type Platform = "x" | "linkedin" | "facebook" | "instagram" | "tiktok" | "youtube";

export const PLATFORMS: { id: Platform; name: string; format: Format; color: string }[] = [
  { id: "x", name: "X", format: "wide", color: "#000000" },
  { id: "linkedin", name: "LinkedIn", format: "wide", color: "#0a66c2" },
  { id: "facebook", name: "Facebook", format: "wide", color: "#1877f2" },
  { id: "instagram", name: "Instagram", format: "vertical", color: "#d62976" },
  { id: "tiktok", name: "TikTok", format: "vertical", color: "#111111" },
  { id: "youtube", name: "YouTube", format: "vertical", color: "#ff0000" },
];
/** Where to upload a video on the networks without a web share link for video. */
export const UPLOAD_URL: Partial<Record<Platform, string>> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
  youtube: "https://www.youtube.com/upload",
};

type Props = {
  slug: string;
  storyUrl: string;
  formats: Format[];
  speaker?: string;
  text: string;
  credit: string;
  hashtags: string;
  labels: Record<string, string>;
  /** The signed-in reader's share code: their links carry &by=<code> and earn them tokens. */
  shareCode?: string | null;
  /** Sign-in link back to this panel, shown to readers who aren't signed in. */
  signinHref?: string;
  className?: string;
  /** Where the clips stream from (default: the story's /story/<slug>/video). */
  videoBase?: string;
  /** The section's anchor id (default: share-video). */
  sectionId?: string;
  /** Words before the link in the caption (default: "Full story"). */
  linkLabel?: string;
};

const fill = (s: string, platform: string) => s.replace(/\{platform\}/g, platform);

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** End-of-story panel: the story's mini video, download, and one-click sharing to the networks. */
export function StoryShareVideo({ slug, storyUrl, formats, speaker, text, credit, hashtags, labels, shareCode, signinHref, className = "mt-12", videoBase, sectionId = "share-video", linkLabel = "Full story" }: Props) {
  const [format, setFormat] = useState<Format>(formats[0]);
  const [copied, setCopied] = useState<"caption" | "link" | null>(null);
  const [tip, setTip] = useState<{ kind: "intent" | "upload" | "error"; platform: Platform } | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const blobs = useRef<Partial<Record<Format, Promise<File | null>>>>({});
  const box = useRef<HTMLElement>(null);

  const src = (f: Format) => `${videoBase ?? `/story/${slug}/video`}/${f}.mp4`;
  const fileName = (f: Format) => `raleche-${slug}-${f}.mp4`;
  // Every link we hand out says where it was shared (?source=twitter…), so the admin dashboard can count those visits.
  const linkFor = (source: string) => `${storyUrl}?source=${source}${shareCode ? `&by=${shareCode}` : ""}`;
  const captionFor = (source: string) => [text, `${linkLabel}: ${linkFor(source)}`, credit, hashtags].filter(Boolean).join("\n\n");
  const caption = captionFor("share");
  // Short text for X (the link is added by X): the speaker and the quote.
  const quote = text.split(/\n\n/).pop() || text;
  const shortText = (speaker && !quote.startsWith(speaker) ? `${speaker}: ${quote}` : quote).slice(0, 220);

  const loadFile = (f: Format) =>
    (blobs.current[f] ||= fetch(src(f))
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? new File([b], fileName(f), { type: "video/mp4" }) : null))
      .catch(() => null));

  // Phones that can share a video file: fetch it once the panel is in view, so the share sheet opens right away on tap.
  useEffect(() => {
    try {
      const probe = new File([new Blob([""], { type: "video/mp4" })], "probe.mp4", { type: "video/mp4" });
      if (navigator.canShare?.({ files: [probe] })) setCanShareFiles(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!canShareFiles || !box.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        formats.forEach(loadFile);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(box.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShareFiles]);

  const flash = (what: "caption" | "link") => {
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
  };

  const download = (f: Format) => {
    const a = document.createElement("a");
    a.href = `${src(f)}?download=1`;
    a.download = fileName(f);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /** Share the video file with the phone's share sheet. Returns false if this device can't. */
  const shareFile = async (f: Format, text = caption) => {
    if (!canShareFiles) return false;
    const file = await loadFile(f);
    if (!file || !navigator.canShare?.({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], text, title: speaker });
    } catch (e) {
      // The reader closed the share sheet: that's fine, not a failure.
      if ((e as Error)?.name !== "AbortError") return false;
    }
    return true;
  };

  const onPlatform = async (p: (typeof PLATFORMS)[number]) => {
    const f = formats.includes(p.format) ? p.format : formats[0];
    setFormat(f);
    const link = encodeURIComponent(linkFor(p.id === "x" ? "twitter" : p.id));
    const platformCaption = captionFor(p.id === "x" ? "twitter" : p.id);
    const intent =
      p.id === "x" ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}&url=${link}`
      : p.id === "linkedin" ? `https://www.linkedin.com/sharing/share-offsite/?url=${link}`
      : p.id === "facebook" ? `https://www.facebook.com/sharer/sharer.php?u=${link}`
      : null;
    if (intent) {
      // Open first (still inside the click, so it isn't blocked as a popup), then copy the caption.
      window.open(intent, "_blank", "noopener,noreferrer,width=640,height=640");
      copyText(platformCaption);
      setTip({ kind: "intent", platform: p.id });
      return;
    }
    // Instagram, TikTok, YouTube: no web link to post a video. On phones the share sheet sends the file straight to the app.
    copyText(platformCaption);
    if (await shareFile(f, platformCaption)) {
      setTip(null);
      return;
    }
    download(f);
    setTip({ kind: "upload", platform: p.id });
  };

  const onShare = async () => {
    copyText(caption);
    if (!(await shareFile(format))) setTip({ kind: "error", platform: "x" });
  };

  const platformName = (id: Platform) => PLATFORMS.find((p) => p.id === id)!.name;
  const tab = (f: Format) =>
    `flex-1 border-2 border-ink px-3 py-2 text-left ${format === f ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink/5"}`;

  return (
    <section ref={box} id={sectionId} className={`${className} scroll-mt-24 border-[3px] border-ink`}>
      <div className="flex items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{labels.shareVideoTitle}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{labels.shareVideoBadge}</span>
      </div>
      <div className="px-5 py-5">
        <p className="font-serif text-ink/80">{labels.shareVideoDek}</p>
        {shareCode ? (
          <p className="mt-3 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest">★ {labels.shareVideoEarn}</p>
        ) : signinHref ? (
          <p className="mt-3 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest">
            ★ {labels.shareVideoEarnSignIn} <a href={signinHref} className="text-accent underline">{labels.shareVideoSignIn}</a>
          </p>
        ) : null}

        {formats.length > 1 && (
          <div className="mt-4 flex gap-2" role="tablist">
            {formats.map((f) => (
              <button key={f} type="button" role="tab" aria-selected={format === f} onClick={() => setFormat(f)} className={tab(f)}>
                <span className="block font-mono text-[11px] font-bold uppercase tracking-widest">{f === "vertical" ? labels.shareVideoVertical : labels.shareVideoWide}</span>
                <span className={`block font-mono text-[10px] uppercase tracking-wider ${format === f ? "text-white/70" : "text-ink/50"}`}>{f === "vertical" ? labels.shareVideoVerticalFor : labels.shareVideoWideFor}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-center bg-ink/5 p-3">
          <video
            key={format}
            src={src(format)}
            controls
            muted
            loop
            playsInline
            preload="metadata"
            className={format === "vertical" ? "aspect-[9/16] w-full max-w-[260px] bg-ink" : "aspect-video w-full bg-ink"}
          />
        </div>
        {credit && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink/50">{credit}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`${src(format)}?download=1`} download={fileName(format)} className="btn-dark">⬇ {labels.shareVideoDownload}</a>
          {canShareFiles && <button type="button" onClick={onShare} className="btn-dark">↗ {labels.shareVideoShare}</button>}
          <button type="button" onClick={() => copyText(caption).then((ok) => ok && flash("caption"))} className="btn-light">
            {copied === "caption" ? `✓ ${labels.shareVideoCopied}` : labels.shareVideoCopyCaption}
          </button>
          <button type="button" onClick={() => copyText(linkFor("link")).then((ok) => ok && flash("link"))} className="btn-light">
            {copied === "link" ? `✓ ${labels.shareVideoCopied}` : labels.shareVideoCopyLink}
          </button>
        </div>

        <p className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{labels.shareVideoOn}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPlatform(p)}
              className="flex items-center gap-2 border-2 border-ink bg-white px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-white"
            >
              <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
              {p.name}
              <span className="ml-auto hidden font-normal text-[10px] opacity-50 min-[420px]:inline">{p.format === "vertical" ? "9:16" : "16:9"}</span>
            </button>
          ))}
        </div>

        {tip && (
          <div role="status" className="mt-4 border-l-[3px] border-terminal-amber bg-terminal-amber/10 px-4 py-3 font-serif text-sm">
            {tip.kind === "intent" && <p>{fill(labels.shareVideoIntentTip, platformName(tip.platform))}</p>}
            {tip.kind === "error" && <p>{labels.shareVideoShareFailed}</p>}
            {tip.kind === "upload" && (
              <>
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest">{fill(labels.shareVideoUploadTitle, platformName(tip.platform))}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>{labels.shareVideoStep1}</li>
                  <li>{labels.shareVideoStep2}</li>
                  <li>{fill(labels.shareVideoStep3, platformName(tip.platform))}</li>
                </ol>
                <a href={UPLOAD_URL[tip.platform]} target="_blank" rel="noopener noreferrer" className="btn-dark mt-3">
                  {fill(labels.shareVideoOpen, platformName(tip.platform))} ↗
                </a>
              </>
            )}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-ink/60 hover:text-ink">{labels.shareVideoSeeCaption}</summary>
          <p className="mt-2 whitespace-pre-line break-words border border-ink/15 bg-ink/[0.03] p-3 font-serif text-sm text-ink/80">{caption}</p>
        </details>
      </div>
    </section>
  );
}
