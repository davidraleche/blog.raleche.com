"use client";
import { useEffect, useState } from "react";
import { StoryShareVideo } from "./StoryShareVideo";

type Props = React.ComponentProps<typeof StoryShareVideo> & { buttonLabel: string; closeLabel: string };

/** "▶ Share as a video" on a book card: the share panel only opens when clicked (also from a #share-<slug> link). */
export function BookShareVideo({ buttonLabel, closeLabel, sectionId, ...panel }: Props) {
  const [open, setOpen] = useState(false);
  const id = sectionId ?? `share-${panel.slug}`;

  useEffect(() => {
    const check = () => window.location.hash === `#${id}` && setOpen(true);
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    if (window.location.hash === `#${id}`) history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="font-mono text-[11px] font-bold uppercase tracking-widest text-accent hover:underline">
        ▶ {buttonLabel}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-4 sm:p-8" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="relative w-full max-w-3xl bg-white">
            <button type="button" onClick={close} aria-label={closeLabel} className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center border-[3px] border-ink bg-white font-mono text-lg font-bold hover:bg-terminal-amber">
              ×
            </button>
            <StoryShareVideo {...panel} sectionId={id} className="" />
          </div>
        </div>
      )}
    </>
  );
}
