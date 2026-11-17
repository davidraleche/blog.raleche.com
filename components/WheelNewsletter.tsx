"use client";
import { NewsletterForm } from "./NewsletterForm";
import { useT } from "./I18nProvider";

/** Shown to signed-out readers after a spin: not ready for an account? Get the free weekly newsletter. */
export function WheelNewsletter({ source }: { source: string }) {
  const t = useT();
  return (
    <div className="mt-5 w-full max-w-sm rounded-xl border border-white/25 bg-black/15 p-4 text-left">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ffd76a]">✉ {t("wheelNewsletterTitle")}</p>
      <p className="mb-3 mt-1 font-serif text-sm text-white/85">{t("wheelNewsletterDek")}</p>
      <NewsletterForm dark compact source={source} />
    </div>
  );
}
