// Send yourself an example of the weekly newsletter, built from the live stories.
//   RESEND_API_KEY=... npx tsx scripts/send-newsletter-example.ts you@example.com
// Without RESEND_API_KEY or an address it writes the HTML to newsletter-preview.html instead.
import { writeFileSync } from "node:fs";
import { db } from "../lib/db";
import { loadWeeklyContent, weeklyNewsletter } from "../lib/weekly-newsletter";

async function main() {
  const [to] = process.argv.slice(2);
  const content = await loadWeeklyContent(db);
  const { subject, html } = weeklyNewsletter(content);
  console.log(`quizzes=${content.quizzes.length} latest=${content.latest.length} mostRead=${content.mostRead.length}`);
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
