// Branded invoice for token purchases: a PDF (attached to the email) and the email itself.
// No server-only imports, so scripts can render a preview too.
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { Locale } from "./i18n/messages";
import { BCP47 } from "./i18n/messages";

export type InvoiceData = {
  number: string;
  paidAt: Date;
  locale: Locale;
  customerName: string | null;
  customerEmail: string;
  tokens: number;
  amountCents: number;
  currency: string;
  card: string | null; // e.g. "Visa •••• 4242"
  balance?: number; // token balance after the purchase
};

type Strings = {
  invoice: string; number: string; date: string; paidWith: string; billedTo: string; description: string; qty: string; amount: string;
  total: string; paid: string; item: (n: string) => string; thanks: string; subject: (n: string) => string; heading: string; body: string;
  balance: string; cta: string; attached: string; footer: string;
};

const S: Record<"en" | "fr" | "es", Strings> = {
  en: {
    invoice: "INVOICE", number: "Invoice number", date: "Date paid", paidWith: "Payment method", billedTo: "Billed to", description: "Description", qty: "Qty",
    amount: "Amount", total: "Total paid", paid: "PAID", item: (n) => `${n} RALECHE tokens`, thanks: "Thank you for supporting independent journalism.",
    subject: (n) => `Your RALECHE invoice ${n}`, heading: "Thank you for your purchase", body: "Your tokens are in your account and ready to unlock executive summaries.",
    balance: "Your balance", cta: "Spend your tokens", attached: "Your invoice is attached as a PDF.", footer: "Your purchases and invoices are always on your account page at raleche.com/account.",
  },
  fr: {
    invoice: "FACTURE", number: "Numéro de facture", date: "Date de paiement", paidWith: "Moyen de paiement", billedTo: "Facturé à", description: "Description", qty: "Qté",
    amount: "Montant", total: "Total payé", paid: "PAYÉ", item: (n) => `${n} jetons RALECHE`, thanks: "Merci de soutenir le journalisme indépendant.",
    subject: (n) => `Votre facture RALECHE ${n}`, heading: "Merci pour votre achat", body: "Vos jetons sont sur votre compte, prêts à débloquer les synthèses.",
    balance: "Votre solde", cta: "Utiliser vos jetons", attached: "Votre facture est jointe en PDF.", footer: "Vos achats et factures sont toujours disponibles sur raleche.com/account.",
  },
  es: {
    invoice: "FACTURA", number: "Número de factura", date: "Fecha de pago", paidWith: "Método de pago", billedTo: "Facturado a", description: "Descripción", qty: "Cant.",
    amount: "Importe", total: "Total pagado", paid: "PAGADO", item: (n) => `${n} tokens RALECHE`, thanks: "Gracias por apoyar el periodismo independiente.",
    subject: (n) => `Tu factura de RALECHE ${n}`, heading: "Gracias por tu compra", body: "Tus tokens ya están en tu cuenta, listos para desbloquear resúmenes ejecutivos.",
    balance: "Tu saldo", cta: "Usar tus tokens", attached: "Adjuntamos tu factura en PDF.", footer: "Tus compras y facturas están siempre en raleche.com/account.",
  },
};
// Chinese email copy; the PDF stays in English because the built-in PDF fonts have no Chinese glyphs.
const ZH = {
  subject: (n: string) => `您的 RALECHE 发票 ${n}`, heading: "感谢您的购买", body: "代币已存入您的账户，可用于解锁执行摘要。", balance: "您的余额",
  cta: "使用代币", attached: "发票已作为 PDF 附件发送。", footer: "您的购买记录和发票随时可在 raleche.com/account 查看。",
};

const pdfStrings = (l: Locale) => (l === "zh" ? S.en : S[l]);
const money = (cents: number, currency: string, l: Locale) => new Intl.NumberFormat(BCP47[l], { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const day = (d: Date, l: Locale) => d.toLocaleDateString(BCP47[l], { year: "numeric", month: "long", day: "numeric" });
// Built-in PDF fonts only cover Latin-1; swap anything else so the PDF never fails to render.
const latin = (s: string) => s.replace(/•/g, "*").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x00-\xFF]/g, "?");

export async function invoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const t = pdfStrings(d.locale);
  const pl: Locale = d.locale === "zh" ? "en" : d.locale;
  const doc = await PDFDocument.create();
  doc.setTitle(`RALECHE ${t.invoice} ${d.number}`);
  doc.setAuthor("RALECHE");
  const page = doc.addPage([612, 792]); // US Letter
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const ink = rgb(0.04, 0.04, 0.04), red = rgb(0.882, 0.145, 0.106), grey = rgb(0.45, 0.45, 0.45), amber = rgb(0.96, 0.65, 0.14);
  const W = 612, M = 54;
  const text = (s: string, x: number, y: number, size: number, font = reg, color = ink) => page.drawText(latin(s), { x, y, size, font, color });
  const right = (s: string, xr: number, y: number, size: number, font = reg, color = ink) => text(s, xr - font.widthOfTextAtSize(latin(s), size), y, size, font, color);

  // Masthead
  page.drawRectangle({ x: 0, y: 700, width: W, height: 92, color: ink });
  text("RALECHE", M, 734, 34, bold, rgb(1, 1, 1));
  right(t.invoice, W - M, 738, 22, bold, amber);
  right("raleche.com", W - M, 718, 10, reg, rgb(0.8, 0.8, 0.8));
  page.drawRectangle({ x: 0, y: 694, width: W, height: 6, color: red });

  // Meta + billed to
  let y = 650;
  const meta: [string, string][] = [[t.number, d.number], [t.date, day(d.paidAt, pl)], ...(d.card ? [[t.paidWith, d.card] as [string, string]] : [])];
  for (const [k, v] of meta) {
    text(k.toUpperCase(), M, y, 8, bold, grey);
    text(v, M, y - 14, 12, reg);
    y -= 38;
  }
  text(t.billedTo.toUpperCase(), 340, 650, 8, bold, grey);
  let by = 636;
  if (d.customerName) { text(d.customerName, 340, by, 12, bold); by -= 16; }
  text(d.customerEmail, 340, by, 11);

  // Line items
  y = Math.min(y, 560) - 10;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: ink });
  text(t.description.toUpperCase(), M + 10, y + 2, 9, bold, rgb(1, 1, 1));
  right(t.qty.toUpperCase(), 420, y + 2, 9, bold, rgb(1, 1, 1));
  right(t.amount.toUpperCase(), W - M - 10, y + 2, 9, bold, rgb(1, 1, 1));
  y -= 34;
  text(t.item(d.tokens.toLocaleString(BCP47[pl])), M + 10, y, 12);
  right("1", 420, y, 12);
  right(money(d.amountCents, d.currency, pl), W - M - 10, y, 12);
  y -= 16;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });

  // Total
  y -= 34;
  page.drawRectangle({ x: 330, y: y - 12, width: W - M - 330, height: 36, borderColor: ink, borderWidth: 2.5 });
  text(t.total.toUpperCase(), 342, y, 10, bold);
  right(money(d.amountCents, d.currency, pl), W - M - 12, y - 2, 16, bold);

  // Paid stamp
  const stamp = t.paid, ss = 46, sw = bold.widthOfTextAtSize(stamp, ss);
  page.drawRectangle({ x: M + 4, y: y - 42, width: sw + 28, height: ss + 12, borderColor: red, borderWidth: 4, rotate: degrees(-8), opacity: 0, borderOpacity: 0.85 });
  page.drawText(stamp, { x: M + 18, y: y - 26, size: ss, font: bold, color: red, rotate: degrees(-8), opacity: 0.85 });

  // Footer
  page.drawLine({ start: { x: M, y: 110 }, end: { x: W - M, y: 110 }, thickness: 3, color: ink });
  text(t.thanks, M, 86, 14, serif);
  text("RALECHE · raleche.com", M, 64, 9, reg, grey);
  right(d.number, W - M, 64, 9, reg, grey);
  return doc.save();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function invoiceEmail(d: InvoiceData) {
  const base = pdfStrings(d.locale);
  const c = d.locale === "zh" ? { ...base, ...ZH } : base;
  const url = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #e5e5e5;color:#666;font-family:Arial,sans-serif;font-size:13px">${esc(k)}</td><td align="right" style="padding:10px 0;border-top:1px solid #e5e5e5;font-family:Arial,sans-serif;font-size:${strong ? 18 : 14}px;${strong ? "font-weight:bold;" : ""}color:#111">${esc(v)}</td></tr>`;
  const html = `<div style="max-width:600px;margin:auto;font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#111">
<div style="background:#000;color:#fff;padding:16px 20px;font-family:Arial Narrow,Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:2px">RALECHE <span style="float:right;color:#f5a623;font-size:14px;letter-spacing:3px;line-height:40px">${esc(base.invoice)}</span></div>
<div style="height:5px;background:#e1251b"></div>
<div style="padding:24px 20px">
<h1 style="font-size:28px;margin:0 0 8px">${esc(c.heading)}</h1>
<p style="margin:0 0 20px;color:#333">${esc(c.body)}</p>
<div style="border:3px solid #000;padding:18px 20px;text-align:center;margin:0 0 20px">
<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#e1251b">+ ${d.tokens.toLocaleString(BCP47[d.locale])}</div>
<div style="font-family:Arial Narrow,Arial,sans-serif;font-weight:800;font-size:44px;line-height:1.1">${esc(base.item(d.tokens.toLocaleString(BCP47[d.locale])))}</div>
${d.balance != null ? `<div style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin-top:6px">${esc(c.balance)}: <b style="color:#111">${d.balance.toLocaleString(BCP47[d.locale])}</b></div>` : ""}
</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${row(base.number, d.number)}${row(base.date, day(d.paidAt, d.locale))}${d.card ? row(base.paidWith, d.card) : ""}${row(base.total, money(d.amountCents, d.currency, d.locale), true)}
</table>
<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#666">📎 ${esc(c.attached)}</p>
<p style="margin:24px 0 0"><a href="${url}/memos" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px">${esc(c.cta)} →</a></p>
</div>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#888;padding:16px 20px 0;border-top:1px solid #e5e5e5;margin:8px 20px 0 20px">${esc(c.footer)}</p></div>`;
  return { subject: c.subject(d.number), html, filename: `RALECHE-invoice-${d.number}.pdf` };
}
