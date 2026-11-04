import { LOCALES, LOCALE_LABEL, LOCALE_NAME, type Locale } from "@/lib/i18n/messages";

export function LanguageToggle({ locale, label }: { locale: Locale; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center border border-white/30">
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/api/lang?l=${l}`}
          hrefLang={l}
          lang={l}
          title={LOCALE_NAME[l]}
          aria-current={l === locale ? "true" : undefined}
          className={`px-2 py-0.5 ${l === locale ? "bg-white text-ink" : "text-white/70 hover:text-white"}`}
        >
          {LOCALE_LABEL[l]}
        </a>
      ))}
    </div>
  );
}
