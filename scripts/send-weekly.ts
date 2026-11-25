// Send a newsletter edition to every subscriber (lib/weekly-send.ts). Run by two Cloud Run jobs that Cloud Scheduler
// starts at 9am Eastern: "newsletter" (Monday/Wednesday briefing) and "newsletter-quotes" (Tuesday/Thursday quotes & quiz).
//   npx tsx scripts/send-weekly.ts [--edition=quotes]          only counts the recipients
//   npx tsx scripts/send-weekly.ts [--edition=quotes] --yes    sends (skipped if that edition went out in the last 12 hours)
import { db } from "../lib/db";
import { lastBriefingAt, sendBriefingToAll, type Edition } from "../lib/weekly-send";

async function main() {
  const edition: Edition = process.argv.includes("--edition=quotes") ? "quotes" : "briefing";
  const subs = await db.subscriber.groupBy({ by: ["language"], where: { status: "subscribed" }, _count: true });
  console.log(`edition=${edition} subscribers ${subs.map((s) => `${s.language}=${s._count}`).join(" ")}`);
  if (!process.argv.includes("--yes")) return;
  const last = await lastBriefingAt(db, edition);
  if (last && Date.now() - last.getTime() < 12 * 3600e3 && !process.argv.includes("--force")) {
    console.log(`Skipped: the ${edition} edition already went out at ${last.toISOString()}`);
    return;
  }
  const r = await sendBriefingToAll(db, edition);
  console.log(`Sent "${r.subject}" to ${r.sent} of ${r.total} subscribers`);
}

main().finally(() => db.$disconnect());
