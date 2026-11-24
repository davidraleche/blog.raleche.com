// Send the briefing to every subscriber (lib/weekly-send.ts). Run by the Cloud Run job "newsletter", which Cloud
// Scheduler starts every Monday and Wednesday at 9am Eastern.
//   npx tsx scripts/send-weekly.ts          only counts the recipients
//   npx tsx scripts/send-weekly.ts --yes    sends (skipped if a briefing already went out in the last 12 hours)
import { db } from "../lib/db";
import { lastBriefingAt, sendBriefingToAll } from "../lib/weekly-send";

async function main() {
  const subs = await db.subscriber.groupBy({ by: ["language"], where: { status: "subscribed" }, _count: true });
  console.log(`subscribers ${subs.map((s) => `${s.language}=${s._count}`).join(" ")}`);
  if (!process.argv.includes("--yes")) return;
  const last = await lastBriefingAt(db);
  if (last && Date.now() - last.getTime() < 12 * 3600e3 && !process.argv.includes("--force")) {
    console.log(`Skipped: a briefing already went out at ${last.toISOString()}`);
    return;
  }
  const r = await sendBriefingToAll(db);
  console.log(`Sent "${r.subject}" to ${r.sent} of ${r.total} subscribers`);
}

main().finally(() => db.$disconnect());
