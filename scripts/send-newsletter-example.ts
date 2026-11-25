// Send yourself an example of the weekly newsletter, built from the live stories.
//   RESEND_API_KEY=... npx tsx scripts/send-newsletter-example.ts you@example.com [--edition=quotes]
// Without RESEND_API_KEY or an address it writes the HTML to newsletter-preview.html instead.
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { loadQuotesContent, loadWeeklyContent, quotesNewsletter, weeklyNewsletter } from "../lib/weekly-newsletter";
import { emailBooksBlock } from "../lib/email-books";
import { withCommunity } from "../lib/community-email";
import { withLogo } from "../lib/email-brand";

async function main() {
  const to = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const quotes = process.argv.includes("--edition=quotes");
  let built: { subject: string; html: string };
  if (quotes) {
    // Tuesday/Thursday: quotes, quizzes, 3 random books.
    const content = await loadQuotesContent(db);
    built = quotesNewsletter(content, { books: await emailBooksBlock("en", { count: 3, random: true }) });
    console.log(`quotes=${content.quotes.length} quizzes=${content.quizzes.length}`);
  } else {
    // Same as a real send: books after the latest stories, community box at the end (lib/email.ts adds it).
    const content = await loadWeeklyContent(db);
    built = weeklyNewsletter(content, { books: await emailBooksBlock("en") });
    console.log(`quizzes=${content.quizzes.length} latest=${content.latest.length} mostRead=${content.mostRead.length}`);
  }
  const { subject } = built;
  const html = withLogo(withCommunity(built.html, "en"));
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) {
    writeFileSync("newsletter-preview.html", html);
    console.log(`Preview written to newsletter-preview.html (subject: ${subject})`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>", to, subject: `[EXAMPLE] ${subject}`, html }),
  });
  console.log(res.ok ? `Sent "[EXAMPLE] ${subject}" to ${to}` : `Resend error ${res.status}: ${await res.text()}`);
}

main().finally(() => db.$disconnect());
