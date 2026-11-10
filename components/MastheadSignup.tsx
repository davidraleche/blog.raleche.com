"use client";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "./NewsletterForm";

/** Newsletter signup under the masthead, homepage only, set in a highlighted box so it stands out. */
export function MastheadSignup({ title, text }: { title: string; text: string }) {
  if (usePathname() !== "/") return null;
  return (
    <div className="w-full max-w-2xl border-[3px] border-ink bg-terminal-amber/15 px-5 py-5 text-center shadow-[6px_6px_0_#f5a623] sm:px-8">
      <p className="font-display text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">✉ {title}</p>
      <p className="mb-4 mt-1 font-serif text-lg text-ink/75">{text}</p>
      <NewsletterForm source="masthead" />
    </div>
  );
}
