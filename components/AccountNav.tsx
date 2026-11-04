"use client";
import Link from "next/link";
import { useT } from "./I18nProvider";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account", label: "tabOverview" },
  { href: "/account/summaries", label: "tabSummaries" },
  { href: "/account/invoices", label: "tabInvoices" },
  { href: "/account/profile", label: "tabProfile" },
] as const;

export function AccountNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="mt-8 flex gap-6 overflow-x-auto border-b border-ink/15">
      {TABS.map((tab) => {
        const active = path === tab.href;
        return (
          <Link key={tab.href} href={tab.href} className={`-mb-px whitespace-nowrap border-b-[3px] pb-3 font-mono text-[11px] uppercase tracking-[0.18em] ${active ? "border-accent text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
