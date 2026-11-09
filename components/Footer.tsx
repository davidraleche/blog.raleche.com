import Link from "next/link";
import { db } from "@/lib/db";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";

export async function Footer() {
  const { locale, t } = await getI18n();
  const categories = await localizeFields(locale, await db.category.findMany({ orderBy: { sortOrder: "asc" } }), ["name"]);
  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="inline-block bg-white p-1"><Logo size="sm" /></div>
          <p className="mt-5 max-w-sm font-serif text-lg text-white/80">{t("tagline")}</p>
          <div className="mt-6 max-w-sm"><NewsletterForm dark source="footer" /></div>
        </div>
        <div>
          <p className="kicker mb-4 text-white/50">{t("sections")}</p>
          <ul className="space-y-2 font-display text-xl font-semibold uppercase">
            <li><Link href="/" className="hover:text-accent">{t("latest")}</Link></li>
            <li><Link href="/speakers" className="hover:text-accent">{t("speakers")}</Link></li>
            <li><Link href="/hosts" className="hover:text-accent">{t("hosts")}</Link></li>
            <li><Link href="/executive-summaries" className="hover:text-accent">{t("executiveSummaries")}</Link></li>
            <li><Link href="/books" className="hover:text-accent">{t("books")}</Link></li>
            <li><Link href="/play" className="hover:text-accent">{t("play")}</Link></li>
            {categories.map((c) => <li key={c.id}><Link href={`/category/${c.slug}`} className="hover:text-accent">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="kicker mb-4 text-white/50">Raleche</p>
          <ul className="space-y-2 font-display text-xl font-semibold uppercase">
            <li><Link href="/store" className="hover:text-accent">{t("store")}</Link></li>
            <li><Link href="/account" className="hover:text-accent">{t("account")}</Link></li>
            <li><Link href="/search" className="hover:text-accent">{t("search")}</Link></li>
            <li><Link href="/privacy" className="hover:text-accent">{t("privacy")}</Link></li>
            <li><Link href="/terms" className="hover:text-accent">{t("terms")}</Link></li>
            <li><a href="https://tts42.com" className="hover:text-accent">Tech Team Strategy</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 font-mono text-[11px] uppercase tracking-widest text-white/40">
          © {new Date().getFullYear()} Raleche. {t("courtesy")}
        </p>
      </div>
    </footer>
  );
}
