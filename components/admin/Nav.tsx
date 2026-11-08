"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/admin", "Dashboard", "F1"],
  ["/admin/posts", "Posts", "F2"],
  ["/admin/categories", "Categories", "F3"],
  ["/admin/members", "Members", "F4"],
  ["/admin/tokens", "Tokens", "T"],
  ["/admin/comments", "Comments", "C"],
  ["/admin/quizzes", "Quizzes", "Q"],
  ["/admin/newsletter", "Newsletter", "F6"],
  ["/admin/import", "Import TTS42", "F8"],
  ["/admin/settings", "Settings", "F9"],
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(([href, label, key]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex items-center justify-between gap-4 whitespace-nowrap border-l-2 px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
              active ? "border-terminal-amber bg-terminal-amber/10 text-terminal-amber" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`}>
            {label}<span className="hidden text-[9px] text-terminal-dim lg:inline">{key}</span>
          </Link>
        );
      })}
    </nav>
  );
}
