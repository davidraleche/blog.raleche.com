import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { tagIndex } from "@/lib/tags";
import { personSlug } from "@/lib/people";
import { getSpeakerQuotes } from "@/lib/quotes";
import { translateMany } from "@/lib/translate";
import { BookCover } from "@/components/BookCover";
import type { SpeakerQuote } from "@/components/QuoteWheel";

export const metadata = {
  title: "Explore",
  description: "Browse RALECHE by topic, speaker and host, and dig into the vocabulary, quotes and books from our interviews with tech leaders.",
  alternates: { canonical: "/explore" },
};

const TOP_TAGS = 30;
const TOP_PEOPLE = 24;
const chip = "border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white";

/** One hub for every way into the site: topics, speakers, hosts, vocabulary, quotes and books, each with a "See all" link. */
export default async function Explore() {
  const { locale, t } = await getI18n();
  const published = { status: "published", publishedAt: { lte: new Date() } };
  const [tags, speakers, hosts, vocabRows, vocabCount, quotes, books] = await Promise.all([
    tagIndex(),
    db.post.groupBy({ by: ["speaker"], where: { ...published, speaker: { not: null } }, _count: true }),
    db.post.groupBy({ by: ["host"], where: { ...published, host: { not: null } }, _count: true }),
    db.vocabTerm.findMany({ where: { post: published }, orderBy: { createdAt: "desc" }, take: 40, select: { term: true, definition: true, who: true, post: { select: { englishOnly: true } } } }),
    db.vocabTerm.count({ where: { post: published } }),
    getSpeakerQuotes(locale).catch((): SpeakerQuote[] => []),
    db.book.findMany({
      where: { mentions: { some: { post: { status: "published" } } } },
      select: { title: true, author: true, coverUrl: true, _count: { select: { mentions: true } } },
    }),
  ]);

  const topics = [...tags.entries()].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name));
  const people = (rows: { _count: number }[], key: "speaker" | "host") =>
    (rows as ({ _count: number } & Record<typeof key, string | null>)[])
      .filter((r) => r[key])
      .map((r) => ({ name: r[key]!, n: r._count }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const speakerList = people(speakers, "speaker");
  const hostList = people(hosts, "host");

  // Eight distinct recent words, definitions in the reader's language.
  const seen = new Set<string>();
  const words = vocabRows.filter((w) => !seen.has(w.term.toLowerCase()) && seen.add(w.term.toLowerCase())).slice(0, 8);
  const defs = await translateMany(locale, words.map((w) => (w.post.englishOnly ? "" : w.definition))).catch(() => []);

  // Three quotes from three different people when possible, a different set each day.
  const day = Math.floor(Date.now() / 864e5);
  const pickedQuotes: SpeakerQuote[] = [];
  for (let i = 0; i < quotes.length && pickedQuotes.length < 3; i++) {
    const q = quotes[(day * 7 + i * 13) % quotes.length];
    if (!pickedQuotes.some((p) => p.speaker === q.speaker || p.text === q.text)) pickedQuotes.push(q);
  }
  for (let i = 0; i < quotes.length && pickedQuotes.length < 3; i++) if (!pickedQuotes.includes(quotes[i])) pickedQuotes.push(quotes[i]);

  books.sort((a, b) => b._count.mentions - a._count.mentions || a.title.localeCompare(b.title));

  const sections = [
    { id: "topics", label: t("exploreTopics"), n: topics.length },
    { id: "speakers", label: t("speakers"), n: speakerList.length },
    { id: "hosts", label: t("hosts"), n: hostList.length },
    { id: "vocabulary", label: t("vocabTitle"), n: vocabCount },
    { id: "quotes", label: t("quotesNav"), n: quotes.length },
    { id: "books", label: t("books"), n: books.length },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{t("exploreTitle")}</h1>
      <p className="mt-4 max-w-2xl font-serif text-xl text-ink/70">{t("exploreDek")}</p>

      <nav aria-label={t("exploreTitle")} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="border-[3px] border-ink bg-white px-4 py-3 shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5 hover:bg-terminal-amber hover:shadow-[6px_6px_0_#111]">
            <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.15em]">{s.label}</span>
            <span className="mt-1 block font-display text-3xl font-extrabold">{s.n.toLocaleString()}</span>
          </a>
        ))}
      </nav>

      <Section id="topics" title={t("exploreTopics")} dek={t("exploreTopicsDek")} href="/blog" more={t("exploreSeeAll")}>
        <div className="flex flex-wrap gap-2">
          {topics.slice(0, TOP_TAGS).map(([slug, tag]) => (
            <Link key={slug} href={`/tag/${slug}`} className={chip}>
              {tag.name} <span className="text-ink/40">{tag.count}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="speakers" title={t("speakers")} dek={t("exploreSpeakers")} href="/speakers" more={t("exploreSeeAll")}>
        <PeopleChips list={speakerList.slice(0, TOP_PEOPLE)} base="/speakers" />
      </Section>

      <Section id="hosts" title={t("hosts")} dek={t("exploreHosts")} href="/hosts" more={t("exploreSeeAll")}>
        <PeopleChips list={hostList.slice(0, TOP_PEOPLE)} base="/hosts" />
      </Section>

      <Section id="vocabulary" title={t("vocabTitle")} dek={t("exploreVocab")} href="/vocabulary/words" more={t("exploreSeeAll")} extra={{ href: "/vocabulary", label: t("glossaryPlay") }}>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {words.map((w, i) => (
            <div key={w.term} className="border-l-4 border-terminal-amber pl-4">
              <dt className="font-display text-xl font-extrabold">{w.term}</dt>
              <dd className="mt-1 font-serif text-base text-ink/75">{defs[i] || w.definition}</dd>
              <dd className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink/45">{w.who}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="quotes" title={t("quotesNav")} dek={t("exploreQuotes")} href="/quotes" more={t("explorePlayQuotes")}>
        <div className="grid gap-6 md:grid-cols-3">
          {pickedQuotes.map((q) => (
            <figure key={q.slug + q.text} className="border-[3px] border-ink bg-white p-5 shadow-[4px_4px_0_#111]">
              <blockquote className="font-serif text-lg italic leading-snug">“{q.text}”</blockquote>
              <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-widest">
                <Link href={`/story/${q.slug}`} className="font-bold hover:text-accent">{q.speaker}</Link>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="books" title={t("books")} dek={t("exploreBooks")} href="/books" more={t("exploreSeeAll")}>
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {books.slice(0, 8).map((b) => (
            <Link key={b.title} href="/books" className="group flex flex-col gap-2">
              <BookCover title={b.title} author={b.author} coverUrl={b.coverUrl} />
              <span className="line-clamp-2 font-display text-sm font-bold leading-tight group-hover:text-accent">{b.title}</span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ id, title, dek, href, more, extra, children }: { id: string; title: string; dek: string; href: string; more: string; extra?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-14">
      <div className="rule flex flex-wrap items-end justify-between gap-3 pt-3">
        <div>
          <h2 className="hed text-4xl sm:text-5xl">{title}</h2>
          <p className="mt-1 font-serif text-lg text-ink/60">{dek}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {extra && (
            <Link href={extra.href} className="border-[3px] border-ink bg-terminal-amber px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_#111] hover:-translate-y-0.5">
              {extra.label} →
            </Link>
          )}
          <Link href={href} className="border-[3px] border-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-white">
            {more} →
          </Link>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function PeopleChips({ list, base }: { list: { name: string; n: number }[]; base: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((p) => (
        <Link key={p.name} href={`${base}#${personSlug(p.name)}`} className={chip}>
          {p.name} <span className="text-ink/40">{p.n}</span>
        </Link>
      ))}
    </div>
  );
}
