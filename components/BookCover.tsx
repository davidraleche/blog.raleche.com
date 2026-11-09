/** A book cover: the real image when we have one, otherwise a typographic cover in the site's style. */
const PALETTE = ["#0a0a0a", "#e1251b", "#1d4e63", "#f5a623", "#5cb946", "#1565c0"];

export function BookCover({ title, author, coverUrl, size = "md" }: { title: string; author: string; coverUrl?: string | null; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-16" : "w-24";
  if (coverUrl) return <img src={coverUrl} alt={title} loading="lazy" className={`${w} aspect-[2/3] shrink-0 border border-ink/20 object-cover shadow-[3px_3px_0_#0a0a0a]`} />;
  const bg = PALETTE[[...title].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
  const light = bg === "#f5a623" || bg === "#5cb946";
  return (
    <div aria-hidden className={`${w} flex aspect-[2/3] shrink-0 flex-col justify-between border-l-4 border-black/30 p-2 shadow-[3px_3px_0_#0a0a0a]`} style={{ background: bg, color: light ? "#0a0a0a" : "#fff" }}>
      <span className={`font-display font-extrabold uppercase leading-[0.95] ${size === "sm" ? "text-[9px]" : "text-[12px]"} line-clamp-5`}>{title}</span>
      <span className={`font-mono uppercase opacity-80 ${size === "sm" ? "text-[6px]" : "text-[8px]"} line-clamp-2`}>{author}</span>
    </div>
  );
}
