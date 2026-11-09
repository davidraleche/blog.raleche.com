"use client";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "./NewsletterForm";

/** Newsletter signup under the masthead, homepage only. */
export function MastheadSignup({ text }: { text: string }) {
  if (usePathname() !== "/") return null;
  return (
    <div className="w-full max-w-sm text-center md:text-left">
      <p className="mb-1.5 font-serif text-sm text-ink/60">{text}</p>
      <NewsletterForm source="masthead" compact />
    </div>
  );
}
