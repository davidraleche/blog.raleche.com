import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { importFromSource } from "../lib/importer";

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

  const cats = ["AI", "Big Tech", "Leadership", "Startups", "Careers", "Security"];
  for (const [i, name] of cats.entries())
    await db.category.upsert({ where: { name }, create: { name, slug: name.toLowerCase().replace(/\s+/g, "-"), sortOrder: i }, update: {} });

  await db.setting.upsert({ where: { key: "siteName" }, create: { key: "siteName", value: "RALECHE" }, update: {} });
  await db.setting.upsert({ where: { key: "tagline" }, create: { key: "tagline", value: "Technology, AI and the people building what's next." }, update: {} });

  const r = await importFromSource();
  console.log(`Seeded. Imported ${r.created} new / ${r.updated} updated articles from tts42.com`, r.errors);
}

main().finally(() => db.$disconnect());
