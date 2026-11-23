import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { Kicker } from "@/components/Cards";

export const metadata: Metadata = {
  title: "Blog",
  description: "Every RALECHE story, newest first.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const { locale, t, date } = await getI18n();
  const raw = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
  const posts = await localizePosts(locale, raw);

  // Group by month of publication, keeping the newest-first order.
  const months: { label: string; posts: typeof posts }[] = [];
  for (const p of posts) {
    const label = date(p.publishedAt, { month: "long", year: "numeric" });
    if (months.at(-1)?.label !== label) months.push({ label, posts: [] });
    months.at(-1)!.posts.push(p);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{t("blogNav")}</h1>
      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 font-serif text-xl text-ink/70">
        {t("blogDek")}
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">{t("blogCount", { n: posts.length })}</span>
      </p>
      {!posts.length && <p className="py-16 font-serif text-xl text-ink/60">{t("noStories")}</p>}

      {months.map((m) => (
        <section key={m.label} className="mt-12">
          <h2 className="kicker border-b border-ink/15 pb-2">{m.label}</h2>
          <ol>
            {m.posts.map((p) => (
              <li key={p.id} className="border-b border-ink/10">
                <Link href={`/story/${p.slug}`} className="group grid grid-cols-[1fr_120px] gap-4 py-5 sm:grid-cols-[90px_1fr_160px] sm:gap-6">
                  <time dateTime={p.publishedAt?.toISOString()} className="hidden pt-1 font-mono text-[11px] uppercase tracking-widest text-ink/50 sm:block">
                    {date(p.publishedAt, { month: "short", day: "numeric" })}
                  </time>
                  <div>
                    <Kicker post={p} />
                    <h3 className="hed mt-1 text-2xl group-hover:text-accent">{p.title}</h3>
                    {p.dek && <p className="mt-2 line-clamp-2 font-serif text-base text-ink/70">{p.dek}</p>}
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">
                      <span className="sm:hidden">{date(p.publishedAt)} · </span>{t("minRead", { n: p.readMinutes })}
                    </p>
                  </div>
                  <div className="aspect-[40/21] self-start overflow-hidden bg-neutral-200">
                    {p.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverImage} alt="" loading="lazy" width={1200} height={630} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
