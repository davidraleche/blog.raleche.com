// Send the weekly briefing to every subscriber, paced to stay under Resend's rate limit (2 requests a second).
// Same email as the admin "Send to N" button (app/admin/weekly-actions.ts), and records the campaign the same way.
//   npx tsx scripts/send-weekly.ts --yes        (without --yes it only counts the recipients)
// English only: translated versions still go through the admin button.
import { db } from "../lib/db";
import { loadWeeklyContent, weeklyLabels, weeklyNewsletter } from "../lib/weekly-newsletter";
import { emailBooksBlock } from "../lib/email-books";
import { fillBookPitches } from "../lib/book-pitch";
import { withCommunity } from "../lib/community-email";
import { withLogo } from "../lib/email-brand";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const subs = await db.subscriber.findMany({ where: { status: "subscribed" }, orderBy: { createdAt: "asc" } });
  const other = subs.filter((s) => s.language && s.language !== "en");
  console.log(`subscribers=${subs.length} nonEnglish=${other.length}`);
  if (!process.argv.includes("--yes")) return;
  if (other.length) throw new Error("Some subscribers read another language: send from the admin page instead.");
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");

  await fillBookPitches().catch(() => 0);
  const content = await loadWeeklyContent(db);
  const books = await emailBooksBlock("en");
  const labels = weeklyLabels();
  let sent = 0;
  let subject = "";
  for (const s of subs) {
    const email = weeklyNewsletter(content, { labels, unsubscribeKey: s.unsubscribeKey, books });
    subject = email.subject;
    // Same wrapping as lib/email.ts sendEmail (books box is already inside the briefing).
    const html = withLogo(withCommunity(email.html, "en"));
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM || "Raleche <newsletter@raleche.com>", to: s.email, subject, html }),
      });
      if (res.ok) {
        sent++;
        break;
      }
      console.log(`Resend ${res.status} for subscriber ${s.id}: ${(await res.text()).slice(0, 200)}`);
      if (res.status !== 429 && res.status < 500) break;
      await sleep(2000);
    }
    await sleep(600);
  }
  await db.campaign.create({
    data: { subject, body: "_Weekly briefing template: latest, books from our guests, quizzes on new stories, most read, wheel._", status: "sent", sentCount: sent, sentAt: new Date() },
  });
  console.log(`Sent "${subject}" to ${sent} of ${subs.length} subscribers`);
}

main().finally(() => db.$disconnect());
