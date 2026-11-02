import Link from "next/link";
import { db } from "@/lib/db";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

export async function Footer() {
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="inline-block bg-white p-1"><Logo size="sm" /></div>
          <p className="mt-5 max-w-sm font-serif text-lg text-white/80">Technology, AI and the people building what's next.</p>
          <div className="mt-6 max-w-sm"><NewsletterForm dark source="footer" /></div>
        </div>
        <div>
          <p className="kicker mb-4 text-white/50">Sections</p>
          <ul className="space-y-2 font-display text-xl font-semibold uppercase">
            {categories.map((c) => <li key={c.id}><Link href={`/category/${c.slug}`} className="hover:text-accent">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="kicker mb-4 text-white/50">Raleche</p>
          <ul className="space-y-2 font-display text-xl font-semibold uppercase">
            <li><Link href="/membership" className="hover:text-accent">Membership</Link></li>
            <li><Link href="/account" className="hover:text-accent">Account</Link></li>
            <li><Link href="/search" className="hover:text-accent">Search</Link></li>
            <li><Link href="/privacy" className="hover:text-accent">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-accent">Terms</Link></li>
            <li><a href="https://tts42.com" className="hover:text-accent">Tech Team Strategy</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 font-mono text-[11px] uppercase tracking-widest text-white/40">
          © {new Date().getFullYear()} Raleche. Articles courtesy of Tech Team Strategy.
        </p>
      </div>
    </footer>
  );
}
