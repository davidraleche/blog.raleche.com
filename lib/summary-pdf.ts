// Executive summary as a branded, downloadable PDF. No server-only imports, so scripts can render a preview.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type Block = { kind: "h" | "li" | "p"; text: string };

/** Turn the summary's Markdown into simple blocks: headings, bullets and paragraphs, with inline markup stripped. */
export function markdownBlocks(md: string): Block[] {
  const inline = (s: string) =>
    s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, "$1").replace(/<[^>]+>/g, "").trim();
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: "p", text: inline(para.join(" ")) }); para = []; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const li = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (h) { flush(); out.push({ kind: "h", text: inline(h[1]) }); }
    else if (li) { flush(); out.push({ kind: "li", text: inline(li[1]) }); }
    else para.push(line.replace(/^>\s?/, ""));
  }
  flush();
  return out.filter((b) => b.text);
}

// Built-in PDF fonts cover Latin-1 only (fine for English, French and Spanish); swap anything else.
const latin = (s: string) => s.replace(/[•·]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let cur = "";
  for (const word of latin(text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !cur) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function summaryPdf(o: { title: string; speaker?: string | null; url: string; label: string; blocks: Block[]; footer: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(latin(`${o.title} - RALECHE`));
  doc.setAuthor("RALECHE");
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(0.04, 0.04, 0.04), red = rgb(0.882, 0.145, 0.106), grey = rgb(0.45, 0.45, 0.45), amber = rgb(0.96, 0.65, 0.14);
  const W = 612, H = 792, M = 60, TW = W - 2 * M, BOTTOM = 80;
  const pages: PDFPage[] = [];
  let page!: PDFPage, y = 0;

  const newPage = (first: boolean) => {
    page = doc.addPage([W, H]);
    pages.push(page);
    if (first) {
      page.drawRectangle({ x: 0, y: H - 86, width: W, height: 86, color: ink });
      page.drawText("RALECHE", { x: M, y: H - 54, size: 28, font: bold, color: rgb(1, 1, 1) });
      const lab = latin(o.label.toUpperCase());
      page.drawText(lab, { x: W - M - bold.widthOfTextAtSize(lab, 11), y: H - 50, size: 11, font: bold, color: amber });
      page.drawRectangle({ x: 0, y: H - 92, width: W, height: 6, color: red });
      y = H - 140;
    } else {
      page.drawText("RALECHE", { x: M, y: H - 44, size: 12, font: bold, color: ink });
      page.drawLine({ start: { x: M, y: H - 52 }, end: { x: W - M, y: H - 52 }, thickness: 2, color: ink });
      y = H - 84;
    }
  };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(false); };
  const lines = (text: string, font: PDFFont, size: number, lead: number, x = M, width = TW, color = ink) => {
    for (const l of wrap(text, font, size, width)) { ensure(lead); page.drawText(l, { x, y, size, font, color }); y -= lead; }
  };

  newPage(true);
  lines(o.title, bold, 24, 29);
  if (o.speaker) { y -= 2; lines(o.speaker, reg, 12, 16, M, TW, grey); }
  y -= 14;
  for (const b of o.blocks) {
    if (b.kind === "h") { y -= 8; ensure(40); page.drawRectangle({ x: M, y: y - 4, width: 28, height: 3, color: red }); y -= 16; lines(b.text.toUpperCase(), bold, 12, 17); y -= 4; }
    else if (b.kind === "li") { ensure(18); page.drawRectangle({ x: M + 2, y: y + 3, width: 5, height: 5, color: red }); lines(b.text, serif, 12.5, 17, M + 16, TW - 16); y -= 5; }
    else { lines(b.text, serif, 12.5, 17.5); y -= 9; }
  }

  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 56 }, end: { x: W - M, y: 56 }, thickness: 0.75, color: rgb(0.8, 0.8, 0.8) });
    p.drawText(latin(o.footer), { x: M, y: 40, size: 8.5, font: reg, color: grey });
    const n = `${i + 1} / ${pages.length}`;
    p.drawText(n, { x: W - M - reg.widthOfTextAtSize(n, 8.5), y: 40, size: 8.5, font: reg, color: grey });
  });
  return doc.save();
}
