"use client";
import { createContext, useContext } from "react";
import { messages, fmt, type Locale, type Messages } from "@/lib/i18n/messages";

const Ctx = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useT() {
  const locale = useContext(Ctx);
  const m = messages[locale];
  return (key: keyof Messages, vars?: Record<string, string | number>) => fmt(m[key], vars);
}
