import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getLangCookie } from "@/lib/auth";
import { BOT_UA } from "@/lib/seo";
import { messages, fmt, isLocale, BCP47, DEFAULT_LOCALE, type Locale, type Messages } from "./messages";

/** Pick the language from the saved choice, else the browser's Accept-Language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = await getLangCookie();
  if (isLocale(saved)) return saved;
  const h = await headers();
  // Search engines and AI crawlers always index the English original.
  if (BOT_UA.test(h.get("user-agent") ?? "")) return DEFAULT_LOCALE;
  const accept = h.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  const m = messages[locale];
  const t = (key: keyof Messages, vars?: Record<string, string | number>) => fmt(m[key], vars);
  const date = (d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
    d ? new Date(d).toLocaleDateString(BCP47[locale], opts) : "";
  return { locale, m, t, date };
}
