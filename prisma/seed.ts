import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { importFromSource, migrateSections, CATEGORIES } from "../lib/importer";

const db = new PrismaClient();

async function main() {
  const admin = (process.env.ADMIN_EMAIL || "davidr@tech-team-strategy.com").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD;
  const existing = await db.user.findUnique({ where: { email: admin } });
  const passwordHash = pw && !existing?.passwordHash ? await bcrypt.hash(pw, 11) : undefined;
  await db.user.upsert({
    where: { email: admin },
    create: { email: admin, name: "David Raleche", role: "ADMIN", passwordHash },
    update: { role: "ADMIN", ...(passwordHash ? { passwordHash } : {}) },
  });

  const plans = [
    { id: "member", name: "Member", priceCents: 1200, sortOrder: 1, tagline: "Executive summaries on every story.",
      features: "Executive summary on every article\nAd-free reading\nMember-only newsletter edition\nCancel anytime" },
    { id: "executive", name: "Executive Brief", priceCents: 1900, sortOrder: 2, tagline: "The briefing, delivered.",
      features: "Everything in Member\nWeekly executive summary briefing by email\nPrintable one-page briefs\nEarly access to new analysis" },
  ];
  for (const p of plans) await db.plan.upsert({ where: { id: p.id }, create: p, update: {} });

  console.log("People:", await migrateSections()); // fills in speaker/host names

  // The auto-assigned sections were retired: detach their stories, then remove them.
  const retired = await db.category.findMany({ where: { name: { in: [...CATEGORIES] } }, select: { id: true } });
  if (retired.length) {
    await db.post.updateMany({ where: { categoryId: { in: retired.map((c) => c.id) } }, data: { categoryId: null } });
    await db.category.deleteMany({ where: { id: { in: retired.map((c) => c.id) } } });
    console.log(`Removed ${retired.length} retired sections`);
  }

  await db.setting.upsert({ where: { key: "siteName" }, create: { key: "siteName", value: "RALECHE" }, update: {} });
  await db.setting.upsert({ where: { key: "tagline" }, create: { key: "tagline", value: "Technology, AI and the people building what's next." }, update: {} });

  console.log("Quizzes:", await seedQuizzes());

  if (await db.post.count()) return console.log("Seeded. Articles already present; use Admin → Import TTS42 to re-sync.");
  const r = await importFromSource();
  console.log(`Seeded. Imported ${r.created} new / ${r.updated} updated articles from tts42.com`, r.errors);
}

/** Load hand-written quizzes from prisma/quizzes.json for articles that don't have one yet. */
async function seedQuizzes() {
  const file = path.join(__dirname, "quizzes.json");
  if (!fs.existsSync(file)) return "no quizzes.json";
  const bySlug = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  let added = 0;
  for (const [slug, questions] of Object.entries(bySlug)) {
    const post = await db.post.findUnique({ where: { slug }, select: { id: true, quiz: { select: { postId: true } } } });
    if (!post || post.quiz) continue;
    await db.quiz.create({ data: { postId: post.id, questions: questions as object, source: "seed" } });
    added++;
  }
  return `${added} added`;
}

main().finally(() => db.$disconnect());
