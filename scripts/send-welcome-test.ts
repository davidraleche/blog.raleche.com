// Send yourself the newsletter welcome email without subscribing.
//   RESEND_API_KEY=... npx tsx scripts/send-welcome-test.ts you@example.com [en|fr|es|zh]
// Without RESEND_API_KEY it writes the HTML to welcome-preview.html instead.
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { isLocale } from "../lib/i18n/messages";
import { welcomeEmail } from "../lib/welcome-email";

async function main() {
  const [to, lang = "en"] = process.argv.slice(2);
  if (!isLocale(lang)) throw new Error(`Unknown language ${lang}`);
  const stories = await db.post.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 3, select: { title: true, slug: true, dek: true } });
  const { subject, html } = welcomeEmail({ locale: lang, stories });
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) {
    writeFileSync("welcome-preview.html", html);
    console.log(`Preview written to welcome-preview.html (subject: ${subject})`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>", to, subject: `[TEST] ${subject}`, html }),
  });
  console.log(res.ok ? `Sent "[TEST] ${subject}" to ${to}` : `Resend error ${res.status}: ${await res.text()}`);
}

main().finally(() => db.$disconnect());
