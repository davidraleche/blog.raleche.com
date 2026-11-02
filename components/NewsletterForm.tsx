"use client";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";

export function NewsletterForm({ dark = false, source = "site" }: { dark?: boolean; source?: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) return <p className={`font-mono text-sm ${dark ? "text-terminal-up" : "text-green-700"}`}>✓ {state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="source" value={source} />
      <input
        name="email" type="email" required placeholder="Your email" aria-label="Email address"
        className={`flex-1 px-4 py-3 text-base outline-none ${dark ? "border border-white/30 bg-transparent text-white placeholder:text-white/40 focus:border-white" : "input"}`}
      />
      <button disabled={pending} className={dark ? "btn bg-accent text-white hover:bg-white hover:text-ink" : "btn-dark"}>
        {pending ? "…" : "Sign up"}
      </button>
      {state?.error && <p className="text-sm text-accent sm:basis-full">{state.error}</p>}
    </form>
  );
}
