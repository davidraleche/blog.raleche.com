import "server-only";
import { withCommunity, NO_COMMUNITY } from "./community-email";
import { emailBooksBlock, NO_BOOKS } from "./email-books";
import { withLogo } from "./email-brand";
import type { Locale } from "./i18n/messages";

export type Attachment = { filename: string; content: Uint8Array };

/**
 * Every email gets the RALECHE logo on top (lib/email-brand.ts), then near the end the 5-books box with Amazon links
 * (lib/email-books.ts) and the WhatsApp/LinkedIn box (lib/community-email.ts), in the reader's language, unless it opts out.
 */
export async function sendEmail(to: string, subject: string, body: string, attachments: Attachment[] = [], lang: Locale = "en") {
  const books = body.includes(NO_COMMUNITY) || body.includes(NO_BOOKS) ? "" : await emailBooksBlock(lang);
  const html = withLogo(withCommunity(body, lang, books));
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}${attachments.length ? ` attachments=${attachments.map((a) => a.filename).join(",")}` : ""}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>",
      to,
      subject,
      html,
      ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })) } : {}),
    }),
  });
  return res.ok;
}
