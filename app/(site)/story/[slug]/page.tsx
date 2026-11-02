import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getUser, canReadSummaries } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";
import { fmtDate } from "@/lib/utils";
import { GridCard } from "@/components/Cards";
import { NewsletterForm } from "@/components/NewsletterForm";
import { ViewPing } from "./ViewPing";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return db.post.findUnique({ where: { slug }, include: { category: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  if (!post) return {};
  return { title: post.title, description: post.dek, openGraph: { title: post.title, description: post.dek, images: post.coverImage ? [post.coverImage] : [], type: "article" } };
}

export default async function Story({ params }: Props) {
  const { slug } = await params;
  const [post, user] = await Promise.all([load(slug), getUser()]);
  if (!post || (post.status !== "published" && user?.role !== "ADMIN")) notFound();

  const member = canReadSummaries(user);
  const locked = post.premium && !member;
  const body = locked ? post.body.split(/\n\n/).slice(0, 3).join("\n\n") : post.body;
  const related = await db.post.findMany({
    where: { status: "published", id: { not: post.id }, categoryId: post.categoryId },
    include: { category: true }, orderBy: { publishedAt: "desc" }, take: 3,
  });

  return (
    <article>
      <ViewPing postId={post.id} />
      <header className="mx-auto max-w-4xl px-4 pt-10 text-center">
        {post.category && <Link href={`/category/${post.category.slug}`} className="kicker hover:underline">{post.category.name}</Link>}
        {post.status !== "published" && <span className="ml-3 bg-terminal-amber px-2 py-0.5 font-mono text-[10px] uppercase">{post.status}</span>}
        <h1 className="hed mt-4 text-5xl sm:text-7xl">{post.title}</h1>
        {post.dek && <p className="mx-auto mt-6 max-w-3xl font-serif text-xl text-ink/75 sm:text-2xl">{post.dek}</p>}
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/60">
          By <span className="text-ink">{post.authorName}</span> · {fmtDate(post.publishedAt)} · {post.readMinutes} min read
        </p>
      </header>

      {post.coverImage && (
        <figure className="mx-auto mt-10 max-w-6xl px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt="" className="w-full" />
        </figure>
      )}

      <div className="mx-auto mt-10 max-w-3xl px-4">
        <ExecutiveSummary summary={post.executiveSummary} member={member} signedIn={!!user} />

        <div className="prose-article" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />

        {locked && (
          <div className="relative -mt-24 bg-gradient-to-t from-white via-white to-transparent pt-24 text-center">
            <p className="hed text-3xl">This story is for members</p>
            <Link href="/membership" className="btn-dark mt-4">Subscribe to keep reading</Link>
          </div>
        )}

        {post.tags && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-ink/15 pt-6">
            {post.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
              <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white">{t}</Link>
            ))}
          </div>
        )}
        {post.sourceUrl && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Originally published by <a href={post.sourceUrl} className="underline">Tech Team Strategy</a>
          </p>
        )}

        <div className="mt-12 border-y-[3px] border-ink py-8">
          <p className="hed text-3xl">Get the briefing</p>
          <p className="mb-4 mt-1 font-serif text-ink/70">The week's essential stories, free in your inbox.</p>
          <NewsletterForm source={`story:${post.slug}`} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4">
          <h2 className="hed rule pt-3 text-3xl">More {post.category?.name}</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">{related.map((p) => <GridCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </article>
  );
}

function ExecutiveSummary({ summary, member, signedIn }: { summary: string; member: boolean; signedIn: boolean }) {
  if (!summary) return null;
  return (
    <aside className="mb-10 border-[3px] border-ink">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Executive Summary</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-terminal-amber">{member ? "Member" : "Members only"}</span>
      </div>
      {member ? (
        <div className="prose-article prose-base px-5 py-4 prose-h2:text-xl" dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
      ) : (
        <div className="relative px-5 py-5">
          <div aria-hidden className="pointer-events-none select-none space-y-3 blur-[5px]">
            {[90, 75, 85, 60, 80].map((w, i) => <div key={i} className="h-3 bg-ink/40" style={{ width: `${w}%` }} />)}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 px-4 text-center">
            <p className="font-display text-2xl font-bold uppercase">The takeaways, in 60 seconds</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/membership" className="btn-dark">Unlock from $12/mo</Link>
              {!signedIn && <Link href="/signin" className="btn-light">Sign in</Link>}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
