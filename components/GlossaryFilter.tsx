"use client";
import { useEffect, useState } from "react";

/** Hides glossary entries (elements with data-glossary) that don't contain what the reader types. */
export function GlossaryFilter({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const s = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-glossary]").forEach((el) => {
      el.hidden = !!s && !el.dataset.glossary!.includes(s);
    });
    document.querySelectorAll<HTMLElement>("section[id]").forEach((sec) => {
      if (sec.querySelector("[data-glossary]")) sec.hidden = !!s && !sec.querySelector("[data-glossary]:not([hidden])");
    });
  }, [q]);
  return (
    <input
      type="search"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder={placeholder}
      className="ml-auto w-full border-2 border-ink bg-white px-3 py-1 font-serif text-base outline-none focus:bg-terminal-amber/10 sm:w-56"
    />
  );
}
