"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A nav item with a submenu. The nav bar scrolls sideways (overflow hidden), so the panel is position:fixed
 * under the item, rendered in <body>. Opens on hover (desktop) and on tap (phones).
 */
export function NavMenu({ label, href, items }: { label: string; href: string; items: { href: string; label: string; note?: string }[] }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLLIElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = () => {
    clearTimeout(timer.current);
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left - 12, window.innerWidth - 296)), top: r.bottom + 6 });
  };
  const close = () => { timer.current = setTimeout(() => setPos(null), 150); };
  useEffect(() => {
    if (!pos) return;
    const hide = (e: Event) => { const n = e.target as Node; if (!ref.current?.contains(n) && !panel.current?.contains(n)) setPos(null); };
    const off = () => setPos(null);
    document.addEventListener("pointerdown", hide);
    window.addEventListener("scroll", off, { passive: true });
    return () => { document.removeEventListener("pointerdown", hide); window.removeEventListener("scroll", off); };
  }, [pos]);

  return (
    <li ref={ref} onMouseEnter={open} onMouseLeave={close} className="flex items-center">
      <Link href={href} className="whitespace-nowrap hover:text-accent">{label}</Link>
      <button type="button" aria-label={label} aria-expanded={!!pos} onClick={() => (pos ? setPos(null) : open())} className="ml-1 px-1 hover:text-accent">
        <span aria-hidden className={`inline-block text-[9px] transition ${pos ? "rotate-180" : ""}`}>▼</span>
      </button>
      {pos && createPortal(
        <div ref={panel} style={{ left: pos.left, top: pos.top }} onMouseEnter={open} onMouseLeave={close} className="fixed z-50 w-72 border-[3px] border-ink bg-white shadow-[6px_6px_0_#111]">
          {items.map((it) => (
            <Link key={it.href} href={it.href} onClick={() => setPos(null)} className="block border-b border-ink/10 px-4 py-3 normal-case tracking-normal last:border-0 hover:bg-terminal-amber/30">
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.15em]">{it.label}</span>
              {it.note && <span className="mt-0.5 block font-serif text-sm text-ink/60">{it.note}</span>}
            </Link>
          ))}
        </div>,
        document.body,
      )}
    </li>
  );
}
