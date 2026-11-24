"use client";
import { useEffect, useState } from "react";

type Link = { id: string; label: string; icon: string };

/**
 * Sticky reading helper on story pages: back to top, then jumps to the sections the story has.
 * A rail at mid-height on the right, shown once the reader has scrolled past the header. Icons with their labels, smaller on phones.
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
      className={`fixed right-2 top-1/2 z-40 flex -translate-y-1/2 flex-col border-[3px] border-ink bg-white shadow-[4px_4px_0_0_#111] transition duration-300 sm:right-4 ${show ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0"}`}
    >
      {items.map((l, i) => (
        <button
          key={l.id}
          type="button"
          onClick={() => go(l.id)}
          title={l.label}
          aria-label={l.label}
          className={`flex w-16 flex-col items-center gap-1 px-1 py-2 text-center font-mono text-[8px] font-bold uppercase leading-tight tracking-wide hover:bg-ink hover:text-white sm:w-24 sm:px-2 sm:py-2.5 sm:text-[10px] sm:tracking-wider ${i ? "border-t-2 border-ink" : ""}`}
        >
          <span aria-hidden className="text-base leading-none">{l.icon}</span>
          <span className="break-words">{l.label}</span>
        </button>
      ))}
    </nav>
  );
}
