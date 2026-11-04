import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { translateHtml } from "@/lib/translate";
import { GridCard } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { AdSlot } from "@/components/Ads";
import { ViewPing } from "./ViewPing";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.post.findUnique({ where: { slug }, include: { category: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const raw = await load((await params).slug);
  if (!raw) return {};
  const [post] = await localizePosts((await getI18n()).locale, [raw]);
  return { title: post.title, description: post.dek, openGraph: { title: post.title, description: post.dek, images: post.coverImage ? [post.coverImage] : [], type: "article" } };
}

export default async function Story({ params }: Props) {
  const { slug } = await params;
  const [raw, user, { locale, t, date: fmtDate }] = await Promise.all([load(slug), getUser(), getI18n()]);
  if (!raw || (raw.status !== "published" && user?.role !== "ADMIN")) notFound();

  const member = canReadSummaries(user);
  const locked = raw.premium && !member;
  const body = locked ? raw.body.split(/\n\n/).slice(0, 3).join("\n\n") : raw.body;
  const rawRelated = await db.post.findMany({
    where: { status: "published", id: { not: raw.id }, categoryId: raw.categoryId },
    include: { category: true }, orderBy: { publishedAt: "desc" }, take: 3,
  });
  // Only translate the summary for readers who can see it.
  const [[post, ...related], bodyHtml, summaryHtml] = await Promise.all([
    localizePosts(locale, [raw, ...rawRelated]),
    translateHtml(locale, renderMarkdown(body)),
    member && raw.executiveSummary ? translateHtml(locale, renderMarkdown(raw.executiveSummary)) : Promise.resolve(""),
  ]);

  return (
    <article>
      <ViewPing postId={post.id} />
      <header className="mx-auto max-w-4xl px-4 pt-10 text-center">
        {post.category && <Link href={`/category/${post.category.slug}`} className="kicker hover:underline">{post.category.name}</Link>}
        {post.status !== "published" && <span className="ml-3 bg-terminal-amber px-2 py-0.5 font-mono text-[10px] uppercase">{post.status}</span>}
        <h1 className="hed mt-4 text-5xl sm:text-7xl">{post.title}</h1>
        {post.dek && <p className="mx-auto mt-6 max-w-3xl font-serif text-xl text-ink/75 sm:text-2xl">{post.dek}</p>}
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          {t("by")} <span className="text-ink">{post.authorName}</span> · {fmtDate(post.publishedAt)} · {t("minRead", { n: post.readMinutes })}
        </p>
        {locale !== "en" && <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/40">{t("machineTranslated")}</p>}
      </header>

      {post.coverImage && (
        <figure className="mx-auto mt-10 max-w-3xl px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt="" className="w-full" />
        </figure>
      )}

      <div className="mx-auto mt-10 max-w-3xl px-4">
        <ExecutiveSummary hasSummary={!!raw.executiveSummary} html={summaryHtml} member={member} signedIn={!!user} t={t} />
        <AdSlot name="articleTop" />

        <div className="prose-article" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        {locked && (
          <div className="relative -mt-24 bg-gradient-to-t from-white via-white to-transparent pt-24 text-center">
            <p className="hed text-3xl">{t("storyForMembers")}</p>
            <Link href="/membership" className="btn-dark mt-4">{t("keepReading")}</Link>
          </div>
        )}

        <AdSlot name="articleEnd" />

        {post.tags && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-ink/15 pt-6">
            {post.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
              <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white">{t}</Link>
            ))}
          </div>
        )}
        {post.sourceUrl && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            {t("originallyPublished")} <a href={post.sourceUrl} className="underline">Tech Team Strategy</a>
          </p>
        )}

        <div className="mt-12 border-y-[3px] border-ink py-8">
          <p className="hed text-3xl">{t("getTheBriefing")}</p>
          <p className="mb-4 mt-1 font-serif text-ink/70">{t("briefingInbox")}</p>
          <NewsletterForm source={`story:${post.slug}`} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4">
          <h2 className="hed rule pt-3 text-3xl">{t("more", { name: post.category?.name ?? "" })}</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">{related.map((p) => <GridCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </article>
  );
}

function ExecutiveSummary({ hasSummary, html, member, signedIn, t }: { hasSummary: boolean; html: string; member: boolean; signedIn: boolean; t: Awaited<ReturnType<typeof getI18n>>["t"] }) {
  if (!hasSummary) return null;
  return (
    <aside className="mb-10 border-[3px] border-ink">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{t("executiveSummary")}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{member ? t("member") : t("membersOnly")}</span>
      </div>
      {member ? (
        <div className="prose-article prose-base px-5 py-4 prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="relative px-5 py-5">
          <div aria-hidden className="pointer-events-none select-none space-y-3 blur-[5px]">
            {[90, 75, 85, 60, 80].map((w, i) => <div key={i} className="h-3 bg-ink/40" style={{ width: `${w}%` }} />)}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 px-4 text-center">
            <p className="font-display text-2xl font-bold uppercase">{t("takeaways")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/membership" className="btn-dark">{t("unlockFrom")}</Link>
              {!signedIn && <Link href="/signin" className="btn-light">{t("signIn")}</Link>}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
