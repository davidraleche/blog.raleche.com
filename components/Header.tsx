import Link from "next/link";
import { db } from "@/lib/db";
import { getUser, activePlan } from "@/lib/auth";
import { Logo } from "./Logo";

export async function Header() {
  const [user, categories, name] = await Promise.all([
    getUser(),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.setting.findUnique({ where: { key: "siteName" } }),
  ]);
  const plan = activePlan(user);
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <header className="border-b border-ink bg-white">
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em]">
          <span className="hidden sm:block">{date}</span>
          <div className="ml-auto flex items-center gap-5">
            {user?.role === "ADMIN" && <Link href="/admin" className="text-terminal-amber hover:underline">Admin</Link>}
            {user ? (
              <Link href="/account" className="hover:underline">{user.name?.split(" ")[0] || "Account"}</Link>
            ) : (
              <Link href="/signin" className="hover:underline">Sign in</Link>
            )}
            {!plan && <Link href="/membership" className="bg-accent px-3 py-1 hover:bg-white hover:text-ink">Subscribe</Link>}
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6">
        <Link href="/"><Logo text={name?.value || "RALECHE"} /></Link>
      </div>
      <nav className="border-t border-ink/10">
        <ul className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] [scrollbar-width:none]">
          <li><Link href="/" className="whitespace-nowrap hover:text-accent">Latest</Link></li>
          {categories.map((c) => (
            <li key={c.id}><Link href={`/category/${c.slug}`} className="whitespace-nowrap hover:text-accent">{c.name}</Link></li>
          ))}
          <li><Link href="/executive-summaries" className="whitespace-nowrap text-accent">Executive Summaries</Link></li>
          <li className="ml-auto"><Link href="/search" className="whitespace-nowrap hover:text-accent">Search</Link></li>
        </ul>
      </nav>
    </header>
  );
}
