import "server-only";
import { cache } from "react";
import { db } from "./db";
import { translateMany } from "./translate";
import type { Locale } from "./i18n/messages";
import type { SpeakerQuote } from "@/components/QuoteWheel";

/** Quotes for the quote wheel: complete quoted sentences from each story with a speaker, in the reader's language. */
export const getSpeakerQuotes = cache(async (locale: Locale): Promise<SpeakerQuote[]> => {
  const posts = await db.post.findMany({ where: { status: "published", speaker: { not: null } }, select: { slug: true, title: true, speaker: true, body: true } });
  const raw: SpeakerQuote[] = posts.flatMap((p) =>
    [...p.body.matchAll(/_?[“"]([^"”\n]{50,220})[”"]_?/g)]
      .map((m) => m[1].replace(/^[_\s]+|[_\s]+$/g, ""))
      .filter((q) => /^[A-Z]/.test(q) && /[.!?]$/.test(q))
      .map((text) => ({ text, speaker: p.speaker!, slug: p.slug, title: p.title })),
  );
  const text = await translateMany(locale, raw.map((q) => q.text));
  return raw.map((q, i) => ({ ...q, text: text[i] ?? q.text }));
});

export function quoteWheelLabels(t: (k: never, vars?: Record<string, string | number>) => string) {
  const tt = t as unknown as (k: string) => string;
  return { title: tt("quoteWheelTitle"), dek: tt("quoteWheelDek"), spin: tt("spin"), spinAgain: tt("spinAgain"), quote: tt("quoteWord"), won: tt("quoteWheelWon"), wonDetail: tt("quoteWheelWonDetail"), signIn: tt("quoteWheelSignIn"), signInDek: tt("quoteWheelSignInDek"), readStory: tt("readFullStory"), close: tt("close") };
}
