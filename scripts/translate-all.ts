// Pre-translate every published story, executive summary, category and plan into all languages,
// so readers never wait for a first translation. Safe to re-run: cached text is skipped.
import { db } from "../lib/db";
import { LOCALES } from "../lib/i18n/messages";
import { renderMarkdown } from "../lib/markdown";
import { translateHtml, translateMany } from "../lib/translate";

async function main() {
  const posts = await db.post.findMany({ where: { status: "published" }, include: { category: true } });
  const [categories, plans] = await Promise.all([db.category.findMany(), db.plan.findMany()]);
  for (const lang of LOCALES.filter((l) => l !== "en")) {
    await translateMany(lang, [
      ...posts.flatMap((p) => [p.title, p.dek, p.category?.name ?? ""]),
      ...categories.map((c) => c.name),
      ...plans.flatMap((p) => [p.name, p.tagline, p.features]),
    ]);
    for (const p of posts) {
      await translateHtml(lang, renderMarkdown(p.body));
      if (p.executiveSummary) await translateHtml(lang, renderMarkdown(p.executiveSummary));
    }
    console.log(`${lang}: ${posts.length} stories done`);
  }
  console.log(`translations cached: ${await db.translation.count()}`);
}

main().finally(() => db.$disconnect());
