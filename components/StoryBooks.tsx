import Link from "next/link";
import { BookCover } from "./BookCover";
import { amazonUrl } from "@/lib/books";

type Book = { id: string; slug: string; title: string; author: string; asin: string | null; coverUrl: string | null };
type BookMention = { id: string; who: string; relation: string; note: string; book: Book };
type PersonMention = { id: string; name: string; who: string; stance: string; note: string };

export function StoryBooks({ books, people, tag, labels }: { books: BookMention[]; people: PersonMention[]; tag: string | null; labels: Record<string, string> }) {
  if (!books.length && !people.length) return null;
  const admired = people.filter((p) => p.stance === "admires");
  const criticized = people.filter((p) => p.stance === "criticizes");
  return (
    <section id="books" className="mt-12 border-[3px] border-ink">
      {books.length > 0 && (
        <>
          <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{labels.onTheirShelf}</span>
            <Link href="/books" className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber hover:underline">{labels.books} →</Link>
          </div>
          <ul className="divide-y divide-ink/10 px-5">
            {books.map((m) => (
              <li key={m.id} className="flex gap-4 py-4">
                <BookCover title={m.book.title} author={m.book.author} coverUrl={m.book.coverUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-bold leading-tight">{m.book.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink/60">{m.book.author}</p>
                  <p className="mt-1 font-serif text-sm"><span className="font-bold">{m.who}</span> {labels[`relation_${m.relation}`]}{m.note && <span className="text-ink/70">: “{m.note}”</span>}</p>
                  <a href={amazonUrl(m.book, tag)} target="_blank" rel="sponsored nofollow noopener" className="mt-2 inline-block bg-terminal-amber px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-ink hover:text-white">{labels.buyOnAmazon}</a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {(admired.length > 0 || criticized.length > 0) && (
        <div className={`grid gap-6 px-5 py-5 sm:grid-cols-2 ${books.length ? "border-t-[3px] border-ink" : ""}`}>
          {[[labels.peopleTheyAdmire, admired, "text-green-700"], [labels.peopleTheyCriticize, criticized, "text-accent"]].map(([title, list, color]) =>
            (list as PersonMention[]).length ? (
              <div key={title as string}>
                <p className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${color}`}>{title as string}</p>
                <ul className="mt-2 space-y-2 font-serif text-sm">
                  {(list as PersonMention[]).map((p) => (
                    <li key={p.id}><span className="font-bold">{p.name}</span>{p.note && <span className="text-ink/70">: {p.note}</span>}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}
      {books.length > 0 && <p className="border-t border-ink/10 px-5 py-2 font-mono text-[9px] uppercase tracking-widest text-ink/40">{labels.affiliateNote}</p>}
    </section>
  );
}
