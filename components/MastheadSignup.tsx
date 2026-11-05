"use client";
import { usePathname } from "next/navigation";
import { NewsletterForm } from "./NewsletterForm";

/** Newsletter signup under the masthead, homepage only. */
export function MastheadSignup({ text }: { text: string }) {
  if (usePathname() !== "/") return null;
  return (
    <div className="w-full max-w-xl text-center">
      <p className="mb-3 font-serif text-lg text-ink/70">{text}</p>
      <NewsletterForm source="masthead" />
    </div>
  );
}
