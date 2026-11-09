"use client";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "./NewsletterForm";

/** Newsletter signup under the masthead, homepage only. */
export function MastheadSignup({ text }: { text: string }) {
  if (usePathname() !== "/") return null;
  return (
    <div className="w-full max-w-xl text-center md:text-left">
      <p className="mb-2 font-serif text-base text-ink/70">{text}</p>
      <NewsletterForm source="masthead" />
    </div>
  );
}
