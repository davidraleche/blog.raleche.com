// "5 books to read" box in every email to readers (added by lib/email.ts, above the community box).
// Books our guests recommend, with their cover, who recommended them and a big "Buy on Amazon" button carrying
// the affiliate tag. Five of the most-mentioned books, a different five each week.
// No server-only imports, so scripts can render emails too.
import { db } from "./db";
import { amazonTag, amazonUrl } from "./books";
import { emailImage } from "./email-image";
import type { Locale } from "./i18n/messages";

const TEXT: Record<Locale, { kicker: string; title: string; dek: string; by: string; buy: string; more: string; disclosure: string }> = {
  en: {
    kicker: "Reading list",
    title: "5 books our guests swear by",
    dek: "The books the leaders we interview keep coming back to. Tap a cover or a button to get yours on Amazon.",
    by: "Recommended by",
    buy: "Buy on Amazon →",
    more: "See all the books on Raleche",
    disclosure: "As an Amazon Associate, Raleche earns from qualifying purchases, at no extra cost to you.",
  },
  fr: {
    kicker: "À lire",
    title: "5 livres que nos invités recommandent",
    dek: "Les livres auxquels les dirigeants que nous interviewons reviennent sans cesse. Touchez une couverture ou un bouton pour l'obtenir sur Amazon.",
    by: "Recommandé par",
    buy: "Acheter sur Amazon →",
    more: "Voir tous les livres sur Raleche",
    disclosure: "En tant que Partenaire Amazon, Raleche perçoit une commission sur les achats éligibles, sans frais pour vous.",
  },
  es: {
    kicker: "Para leer",
    title: "5 libros que nuestros invitados recomiendan",
    dek: "Los libros a los que vuelven una y otra vez los líderes que entrevistamos. Toca una portada o un botón para conseguirlo en Amazon.",
    by: "Recomendado por",
    buy: "Comprar en Amazon →",
    more: "Ver todos los libros en Raleche",
    disclosure: "Como Afiliado de Amazon, Raleche gana con las compras que reúnen los requisitos, sin coste extra para ti.",
  },
  zh: {
    kicker: "书单",
    title: "嘉宾力荐的 5 本书",
    dek: "我们采访的领导者反复提到的书。点击封面或按钮即可在 Amazon 购买。",
    by: "推荐人",
    buy: "在 Amazon 购买 →",
    more: "在 Raleche 查看全部书籍",
    disclosure: "作为 Amazon 联盟成员，Raleche 从符合条件的购买中获得佣金，您无需额外付费。",
  },
};

type EmailBook = { title: string; author: string; cover: string | null; url: string; who: string[]; note: string };

let cache: { at: number; books: EmailBook[] } | null = null;

/** Five books for this week: the most-mentioned books, rotating by week. Cached 10 minutes. */
export async function emailBooks(): Promise<EmailBook[]> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache.books;
  const [all, tag] = await Promise.all([
    db.book.findMany({ select: { title: true, author: true, asin: true, coverUrl: true, mentions: { select: { who: true, relation: true, note: true } } } }),
    amazonTag(),
  ]);
  const ranked = all.filter((b) => b.mentions.length).sort((a, b) => b.mentions.length - a.mentions.length || a.title.localeCompare(b.title)).slice(0, 25);
  const week = Math.floor(Date.now() / (7 * 864e5));
  const start = ranked.length > 5 ? (week * 5) % ranked.length : 0;
  const pick = Array.from({ length: Math.min(5, ranked.length) }, (_, i) => ranked[(start + i) % ranked.length]);
  const books = pick.map((b) => {
    const rec = b.mentions.find((m) => m.relation !== "wrote" && m.note) ?? b.mentions.find((m) => m.relation !== "wrote") ?? b.mentions[0];
    return {
      title: b.title,
      author: b.author,
      cover: emailImage(b.coverUrl, 256),
      url: amazonUrl(b, tag),
      who: [...new Set(b.mentions.filter((m) => m.relation !== "wrote").map((m) => m.who))].slice(0, 3),
      note: rec?.note ?? "",
    };
  });
  cache = { at: Date.now(), books };
  return books;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SANS = "Helvetica,Arial,sans-serif";

/** The box, or "" when there are no books. */
export async function emailBooksBlock(lang: Locale = "en") {
  const books = await emailBooks().catch(() => []);
  if (!books.length) return "";
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
${b.who.length ? `<div style="font-family:Georgia,serif;font-size:14px;color:#333;margin-top:6px">${esc(t.by)} <b>${esc(b.who.join(", "))}</b>${b.note ? `: <i style="color:#555">“${esc(b.note.length > 120 ? `${b.note.slice(0, 117)}…` : b.note)}”</i>` : ""}</div>` : ""}
<div style="margin-top:10px"><a href="${esc(b.url)}" style="display:inline-block;background:#ff9900;color:#111;padding:10px 16px;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:bold;border:2px solid #111">${esc(t.buy)}</a></div>
</td></tr></table></td></tr>`,
    )
    .join("");
  return `<div style="max-width:560px;margin:24px auto 0;padding:18px 20px;border:3px solid #111;background:#fff8ec;font-family:Georgia,serif;color:#111">
<div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#d6261c">📚 ${esc(t.kicker)}</div>
<div style="font-family:${SANS};font-weight:800;font-size:22px;line-height:1.2;margin-top:6px">${esc(t.title)}</div>
<p style="margin:6px 0 4px;font-size:15px;color:#444">${esc(t.dek)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
<p style="margin:8px 0 0;font-family:${SANS};font-size:13px"><a href="${site}/books" style="color:#d6261c;font-weight:bold">${esc(t.more)} →</a></p>
<p style="margin:10px 0 0;font-family:${SANS};font-size:11px;color:#888">${esc(t.disclosure)}</p>
</div>`;
}
