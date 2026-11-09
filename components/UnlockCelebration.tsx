"use client";
import { useEffect, useState } from "react";
import { celebrate, isMuted, unlockJingle } from "@/lib/celebrate";

/** Shown once, right after a reader spends tokens to unlock a summary: fireworks, a jingle and a banner. */
export function UnlockCelebration({ title, detail, target }: { title: string; detail: string; target: "quiz" | "summary" }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    // Land on what was just unlocked: the quiz answers or the summary.
    const el = document.getElementById(target);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    celebrate();
    if (!isMuted()) { try { unlockJingle(); } catch {} }
    // Drop ?unlocked=1 so a reload doesn't celebrate again.
    const u = new URL(window.location.href);
    u.searchParams.delete("unlocked");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="congrats-in fixed inset-x-0 top-20 z-[9999] mx-auto w-[min(92vw,520px)] border-[3px] border-ink bg-terminal-amber px-5 py-4 text-center shadow-[6px_6px_0_#0a0a0a]">
      <p className="font-display text-3xl font-extrabold uppercase">🔓 {title}</p>
      <p className="mt-1 font-serif text-lg">{detail}</p>
      <button type="button" onClick={() => setShow(false)} className="mt-2 font-mono text-[11px] uppercase tracking-widest underline">OK</button>
    </div>
  );
}
