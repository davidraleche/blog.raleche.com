"use client";
import { useEffect, useState } from "react";

type Link = { id: string; label: string; icon: string };

/**
 * Sticky reading helper on story pages: back to top, then jumps to the sections the story has.
 * Appears once the reader has scrolled past the header. Labels show from the sm breakpoint; phones get icons.
 */
export function StoryJump({ links, topLabel }: { links: Link[]; topLabel: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    const el = id === "top" ? null : document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", id === "top" ? location.pathname + location.search : `#${id}`);
  };

  const items: Link[] = [{ id: "top", label: topLabel, icon: "↑" }, ...links];
  return (
    <nav
      aria-label="Jump to"
      className={`fixed bottom-4 left-4 z-40 flex border-[3px] border-ink bg-white shadow-[4px_4px_0_0_#111] transition duration-300 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
    >
      {items.map((l, i) => (
        <button
          key={l.id}
          type="button"
          onClick={() => go(l.id)}
          title={l.label}
          aria-label={l.label}
          className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-white ${i ? "border-l-2 border-ink" : ""}`}
        >
          <span aria-hidden className="text-sm leading-none">{l.icon}</span>
          <span className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </nav>
  );
}
