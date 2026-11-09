"use client";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";
import { useT } from "./I18nProvider";

export function NewsletterForm({ dark = false, source = "site", compact = false }: { dark?: boolean; source?: string; compact?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) return <p className={`font-mono text-sm ${dark ? "text-terminal-up" : "text-green-700"}`}>✓ {state.message}</p>;
  return (
    <form action={action} className={`flex gap-2 ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>
      <input type="hidden" name="source" value={source} />
      <input
        name="email" type="email" required placeholder={t("yourEmail")} aria-label={t("emailAddress")}
        className={`min-w-0 flex-1 outline-none ${compact ? "!px-3 !py-1.5 text-sm" : "px-4 py-3 text-base"} ${dark ? "border border-white/30 bg-transparent text-white placeholder:text-white/40 focus:border-white" : "input"}`}
      />
      <button disabled={pending} className={`${dark ? "btn bg-accent text-white hover:bg-white hover:text-ink" : "btn-dark"} ${compact ? "!px-3 !py-1.5 !text-[10px]" : ""}`}>
        {pending ? "…" : t("signUp")}
      </button>
      {state?.error && <p className="text-sm text-accent sm:basis-full">{state.error}</p>}
    </form>
  );
}
