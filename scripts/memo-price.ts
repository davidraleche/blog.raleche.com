// Set a memo's price by slug. 0 makes it a free sample anyone can read.
// Usage: npx tsx scripts/memo-price.ts <slug> <tokens>
import { PrismaClient } from "@prisma/client";

const [slug, raw] = process.argv.slice(2);
const price = Number(raw);
if (!slug || !Number.isInteger(price) || price < 0) {
  console.error("Usage: npx tsx scripts/memo-price.ts <slug> <tokens>");
  process.exit(1);
}
const db = new PrismaClient();
db.memo
  .update({ where: { slug }, data: { priceTokens: price }, select: { slug: true, title: true, priceTokens: true, fileSize: true } })
  .then((m) => console.log(`${m.title} (${m.slug}): ${m.priceTokens} tokens${m.fileSize ? "" : " (no PDF uploaded)"}`))
  .finally(() => db.$disconnect());
