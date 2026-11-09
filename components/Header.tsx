import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { BCP47 } from "@/lib/i18n/messages";
import { Logo } from "./Logo";
import { LanguageToggle } from "./LanguageToggle";
import { MastheadSignup } from "./MastheadSignup";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";
import { QuoteWheel } from "./QuoteWheel";
import { getSpeakerQuotes, quoteWheelLabels } from "@/lib/quotes";

export async function Header() {
  const [user, rawCategories, name, { locale, t, date: fmtDate }] = await Promise.all([
    getUser(),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.setting.findUnique({ where: { key: "siteName" } }),
    getI18n(),
  ]);
  const [categories, quotes] = await Promise.all([localizeFields(locale, rawCategories, ["name"]), getSpeakerQuotes(locale)]);
  const date = fmtDate(new Date(), { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <header className="border-b border-ink bg-white">
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em]">
          <span className="hidden sm:block">{date}</span>
          <div className="ml-auto flex items-center gap-4 sm:gap-5">
            <LanguageToggle locale={locale} label={t("language")} />
            {user?.role === "ADMIN" && <Link href="/admin" className="text-terminal-amber hover:underline">{t("admin")}</Link>}
            {user ? (
              <Link href="/account" className="hover:underline">{user.name?.split(" ")[0] || t("account")}</Link>
            ) : (
              <Link href="/signin" className="hover:underline">{t("signIn")}</Link>
            )}
            {user && (
              <Link href="/store" title={t("tokenBalanceTitle")} className="flex items-center gap-1.5 border border-terminal-amber/60 px-2 py-0.5 text-terminal-amber hover:bg-terminal-amber hover:text-ink">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-terminal-amber" />
                {user.tokenBalance.toLocaleString(BCP47[locale])} <span className="hidden sm:inline">{t("tokensLabel")}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left: logo, mission and newsletter signup. Right: the quote wheel. */}
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Link href="/"><Logo text={name?.value || "RALECHE"} /></Link>
          <p className="font-serif text-base italic leading-snug text-ink/70">{t("tagline")}</p>
          <MastheadSignup text={t("briefingInbox")} />
        </div>
        {quotes.length > 0 && <QuoteWheel quotes={quotes} labels={quoteWheelLabels(t)} compact />}
      </div>
      <nav className="border-t border-ink/10">
        <ul className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] [scrollbar-width:none]">
          <li><Link href="/" className="whitespace-nowrap font-bold hover:text-accent">{t("homeNav")}</Link></li>
          <li><Link href="/play" className="whitespace-nowrap font-bold text-terminal-amber hover:text-accent">{t("play")}</Link></li>
          <li><Link href="/books" className="whitespace-nowrap hover:text-accent">{t("books")}</Link></li>
          <li><Link href="/speakers" className="whitespace-nowrap hover:text-accent">{t("speakers")}</Link></li>
          <li><Link href="/hosts" className="whitespace-nowrap hover:text-accent">{t("hosts")}</Link></li>
          {categories.map((c) => (
            <li key={c.id}><Link href={`/category/${c.slug}`} className="whitespace-nowrap hover:text-accent">{c.name}</Link></li>
          ))}
          <li><Link href="/memos" className="whitespace-nowrap text-accent">{t("memoNav")}</Link></li>
          <li><Link href="/store" className="whitespace-nowrap hover:text-accent">{t("store")}</Link></li>
          <li className="ml-auto"><Link href="/search" className="whitespace-nowrap hover:text-accent">{t("search")}</Link></li>
        </ul>
      </nav>
    </header>
  );
}
