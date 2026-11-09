// Books and people mentioned in articles. No server-only imports, so the seed script can use it too.
import { db } from "./db";

export const RELATIONS = ["recommends", "reading", "influenced", "wrote"] as const;
export const STANCES = ["admires", "criticizes"] as const;

export type BookIn = { title: string; author: string; who: string; relation: string; note?: string };
export type PersonIn = { name: string; who: string; stance: string; note?: string };
export type Mentions = { books: BookIn[]; people: PersonIn[] };

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export function isValidMentions(v: unknown): v is Mentions {
  const m = v as Mentions;
  const str = (x: unknown) => typeof x === "string" && x.trim().length > 0;
  return (
    !!m && Array.isArray(m.books) && Array.isArray(m.people) &&
    m.books.every((b) => str(b.title) && str(b.author) && str(b.who) && (RELATIONS as readonly string[]).includes(b.relation)) &&
    m.people.every((p) => str(p.name) && str(p.who) && (STANCES as readonly string[]).includes(p.stance))
  );
}

/** Replace an article's book and people mentions. Books are shared across articles (matched by title + author). */
export async function saveMentions(postId: string, m: Mentions) {
  await db.$transaction(async (tx) => {
    await tx.bookMention.deleteMany({ where: { postId } });
    await tx.personMention.deleteMany({ where: { postId } });
    for (const b of m.books) {
      const title = b.title.trim(), author = b.author.trim();
      let book = await tx.book.findUnique({ where: { title_author: { title, author } } });
      if (!book) {
        let slug = slugify(`${title} ${author}`) || `book-${Date.now()}`;
        if (await tx.book.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
        book = await tx.book.create({ data: { title, author, slug } });
      }
      await tx.bookMention.upsert({
        where: { bookId_postId_who: { bookId: book.id, postId, who: b.who.trim() } },
        create: { bookId: book.id, postId, who: b.who.trim(), relation: b.relation, note: (b.note ?? "").slice(0, 300) },
        update: { relation: b.relation, note: (b.note ?? "").slice(0, 300) },
      });
    }
    for (const p of m.people) await tx.personMention.create({ data: { postId, name: p.name.trim(), who: p.who.trim(), stance: p.stance, note: (p.note ?? "").slice(0, 300) } });
    await tx.post.update({ where: { id: postId }, data: { mentionsAt: new Date() } });
  });
  // Books no longer mentioned anywhere go away, unless an admin attached an Amazon product to them.
  await db.book.deleteMany({ where: { mentions: { none: {} }, asin: null } });
}

/** The article's mentions in the same shape the editor and the AI use. */
export async function loadMentions(postId: string): Promise<Mentions> {
  const [books, people] = await Promise.all([
    db.bookMention.findMany({ where: { postId }, include: { book: true } }),
    db.personMention.findMany({ where: { postId } }),
  ]);
  return {
    books: books.map((b) => ({ title: b.book.title, author: b.book.author, who: b.who, relation: b.relation, note: b.note })),
    people: people.map((p) => ({ name: p.name, who: p.who, stance: p.stance, note: p.note })),
  };
}

/** Amazon link carrying the affiliate tag: the exact product when we know its ASIN, else a search. */
export function amazonUrl(book: { title: string; author: string; asin: string | null }, tag: string | null) {
  const t = tag ? `tag=${encodeURIComponent(tag)}` : "";
  if (book.asin) return `https://www.amazon.com/dp/${encodeURIComponent(book.asin)}${t ? `?${t}` : ""}`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(`${book.title} ${book.author}`)}&i=stripbooks${t ? `&${t}` : ""}`;
}

export async function amazonTag() {
  const s = await db.setting.findUnique({ where: { key: "amazonTag" } });
  return s?.value?.trim() || process.env.AMAZON_TAG || null;
}
