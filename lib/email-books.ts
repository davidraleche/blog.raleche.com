// "5 books to read" box in every email to readers (added by lib/email.ts, above the community box).
// Books our guests recommend, with their cover, who recommended them and a big "Buy on Amazon" button carrying
// the affiliate tag. Five of the most-mentioned books, a different five each week.
// No server-only imports, so scripts can render emails too.
import { db } from "./db";
import { amazonTag, amazonUrl } from "./books";
import { emailImage } from "./email-image";
import { translateMany } from "./translate";
import type { Locale } from "./i18n/messages";

/** In an email body, keeps lib/email.ts from adding the books box at the end (the email places it itself). */
export const NO_BOOKS = "<!--books-inline-->";

const TEXT: Record<Locale, { kicker: string; title: string; dek: string; by: string; wrote: string; buy: string; more: string; disclosure: string }> = {
  en: {
    kicker: "Reading list",
    title: "{n} books from the people we interview",
    dek: "Books our guests wrote or recommend. Tap a cover or a button to get yours on Amazon.",
    by: "Recommended by",
    wrote: "Written by our guest",
    buy: "Buy on Amazon →",
    more: "See all the books on Raleche",
    disclosure: "As an Amazon Associate, Raleche earns from qualifying purchases, at no extra cost to you.",
  },
  fr: {
    kicker: "À lire",
    title: "{n} livres des personnes que nous interviewons",
    dek: "Des livres écrits ou recommandés par nos invités. Touchez une couverture ou un bouton pour l'obtenir sur Amazon.",
    by: "Recommandé par",
    wrote: "Écrit par notre invité",
    buy: "Acheter sur Amazon →",
    more: "Voir tous les livres sur Raleche",
    disclosure: "En tant que Partenaire Amazon, Raleche perçoit une commission sur les achats éligibles, sans frais pour vous.",
  },
  es: {
    kicker: "Para leer",
    title: "{n} libros de las personas que entrevistamos",
    dek: "Libros que nuestros invitados escribieron o recomiendan. Toca una portada o un botón para conseguirlo en Amazon.",
    by: "Recomendado por",
    wrote: "Escrito por nuestro invitado",
    buy: "Comprar en Amazon →",
    more: "Ver todos los libros en Raleche",
    disclosure: "Como Afiliado de Amazon, Raleche gana con las compras que reúnen los requisitos, sin coste extra para ti.",
  },
  zh: {
    kicker: "书单",
    title: "受访嘉宾的 {n} 本书",
    dek: "嘉宾撰写或推荐的书。点击封面或按钮即可在 Amazon 购买。",
    by: "推荐人",
    wrote: "嘉宾著作",
    buy: "在 Amazon 购买 →",
    more: "在 Raleche 查看全部书籍",
    disclosure: "作为 Amazon 联盟成员，Raleche 从符合条件的购买中获得佣金，您无需额外付费。",
  },
};

export type EmailBook = { title: string; author: string; cover: string | null; url: string; who: string[]; wrote: boolean; note: string; pitch: string };

let cache: { at: number; books: EmailBook[] } | null = null;

/** Five books for this week: the most-mentioned books, rotating by week. Cached 10 minutes.
 *  With `random`, `count` books picked at random among all mentioned books instead (not cached). */
export async function emailBooks(opts: { count?: number; random?: boolean } = {}): Promise<EmailBook[]> {
  const count = opts.count ?? 5;
  if (!opts.random && count === 5 && cache && Date.now() - cache.at < 10 * 60e3) return cache.books;
  const [all, tag] = await Promise.all([
    db.book.findMany({ select: { title: true, author: true, asin: true, coverUrl: true, pitch: true, mentions: { select: { who: true, relation: true, note: true } } } }),
    amazonTag(),
  ]);
  const mentioned = all.filter((b) => b.mentions.length);
  const ranked = mentioned.sort((a, b) => b.mentions.length - a.mentions.length || a.title.localeCompare(b.title)).slice(0, 25);
  const week = Math.floor(Date.now() / (7 * 864e5));
  const start = ranked.length > count ? (week * count) % ranked.length : 0;
  const pick = opts.random
    ? [...mentioned].sort(() => Math.random() - 0.5).slice(0, count)
    : Array.from({ length: Math.min(count, ranked.length) }, (_, i) => ranked[(start + i) % ranked.length]);
  const books = pick.map((b) => {
    const recs = b.mentions.filter((m) => m.relation !== "wrote");
    const rec = recs.find((m) => m.note) ?? recs[0] ?? b.mentions.find((m) => m.note) ?? b.mentions[0];
    return {
      title: b.title,
      author: b.author,
      cover: emailImage(b.coverUrl, 256),
      url: amazonUrl(b, tag),
      // Who recommended it; for a book a guest wrote, that guest.
      who: [...new Set((recs.length ? recs : b.mentions).map((m) => m.who))].slice(0, 3),
      wrote: !recs.length,
      note: rec?.note ?? "",
      pitch: b.pitch,
    };
  });
  if (!opts.random && count === 5) cache = { at: Date.now(), books };
  return books;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SANS = "Helvetica,Arial,sans-serif";

/** The box, or "" when there are no books. */
export async function emailBooksBlock(lang: Locale = "en", opts: { count?: number; random?: boolean; pick?: EmailBook[] } = {}) {
  const books = opts.pick ?? (await emailBooks(opts).catch(() => []));
  if (!books.length) return "";
  // Pitches are written in English; translate them for other readers (cached).
  const pitches = await translateMany(lang, books.map((b) => b.pitch)).catch(() => books.map((b) => b.pitch));
  const t = TEXT[lang] ?? TEXT.en;
  const site = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
  const rows = books
    .map(
      (b, i) => `<tr><td style="padding:16px 0;${i ? "border-top:1px solid #e5e5e5;" : ""}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td style="vertical-align:top;width:96px;padding-right:16px"><a href="${esc(b.url)}" style="text-decoration:none">${b.cover
   ? `<img src="${esc(b.cover)}" width="88" alt="${esc(b.title)}" style="display:block;width:88px;height:auto;border:1px solid #ddd">`
   : // No cover saved: a small title cover in the site's style (as on /books).
     `<div style="width:88px;height:132px;box-sizing:border-box;background:#0f3d44;border-top:5px solid #f5a623;padding:8px 7px;font-family:${SANS};font-weight:800;font-size:${b.title.length > 40 ? 10 : 12}px;line-height:1.15;color:#fff;overflow:hidden">${esc(b.title.split(":")[0].slice(0, 60))}<div style="margin-top:6px;font-weight:normal;font-size:8px;letter-spacing:.5px;text-transform:uppercase;color:#f5a623">${esc(b.author.slice(0, 30))}</div></div>`}</a></td>
<td style="vertical-align:top">
<a href="${esc(b.url)}" style="color:#111;text-decoration:none;font-family:${SANS};font-weight:800;font-size:17px;line-height:1.25">${esc(b.title)}</a>
<div style="font-family:${SANS};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-top:3px">${esc(b.author)}</div>
${pitches[i] ? `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.45;color:#111;margin-top:8px;padding-left:10px;border-left:3px solid #ff9900">${esc(pitches[i])}</div>` : ""}
${b.who.length ? `<div style="font-family:Georgia,serif;font-size:14px;color:#333;margin-top:6px">${esc(b.wrote ? t.wrote : t.by)} <b>${esc(b.who.join(", "))}</b>${b.note && !b.wrote && !pitches[i] ? `: <i style="color:#555">“${esc(b.note.length > 120 ? `${b.note.slice(0, 117)}…` : b.note)}”</i>` : ""}</div>` : ""}
<div style="margin-top:10px"><a href="${esc(b.url)}" style="display:inline-block;background:#ff9900;color:#111;padding:10px 16px;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:bold;border:2px solid #111">${esc(t.buy)}</a></div>
</td></tr></table></td></tr>`,
    )
    .join("");
  return `<div style="max-width:560px;margin:24px auto 0;padding:18px 20px;border:3px solid #111;background:#fff8ec;font-family:Georgia,serif;color:#111">
<div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#d6261c">📚 ${esc(t.kicker)}</div>
<div style="font-family:${SANS};font-weight:800;font-size:22px;line-height:1.2;margin-top:6px">${esc(t.title.replace("{n}", String(books.length)))}</div>
<p style="margin:6px 0 4px;font-size:15px;color:#444">${esc(t.dek)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
<p style="margin:8px 0 0;font-family:${SANS};font-size:13px"><a href="${site}/books" style="color:#d6261c;font-weight:bold">${esc(t.more)} →</a></p>
<p style="margin:10px 0 0;font-family:${SANS};font-size:11px;color:#888">${esc(t.disclosure)}</p>
</div>`;
}
