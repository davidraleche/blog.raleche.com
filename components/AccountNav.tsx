"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/summaries", label: "Executive summaries" },
  { href: "/account/invoices", label: "Invoices" },
  { href: "/account/profile", label: "Profile" },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav className="mt-8 flex gap-6 overflow-x-auto border-b border-ink/15">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link key={t.href} href={t.href} className={`-mb-px whitespace-nowrap border-b-[3px] pb-3 font-mono text-[11px] uppercase tracking-[0.18em] ${active ? "border-accent text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
