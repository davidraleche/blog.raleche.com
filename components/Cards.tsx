import Link from "next/link";
import type { Post, Category } from "@prisma/client";
import { getI18n } from "@/lib/i18n/server";

type P = Post & { category: Category | null };

function Img({ post, className = "", eager = false }: { post: P; className?: string; eager?: boolean }) {
  return (
    <div className={`overflow-hidden bg-neutral-200 ${className}`}>
      {post.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt={post.title} loading={eager ? "eager" : "lazy"} width={1200} height={630} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ink font-display text-5xl font-extrabold text-white/20">R</div>
      )}
    </div>
  );
}

export function Kicker({ post }: { post: P }) {
  return post.category ? <span className="kicker">{post.category.name}</span> : null;
}

export async function HeroCard({ post }: { post: P }) {
  const { date: fmtDate } = await getI18n();
  return (
    <Link href={`/story/${post.slug}`} className="group grid items-start gap-6 md:grid-cols-[3fr_2fr]">
      <Img post={post} className="aspect-[40/21]" eager />
      <div>
        <Kicker post={post} />
        <h2 className="hed mt-2 text-3xl group-hover:underline decoration-4 underline-offset-4 sm:text-4xl">{post.title}</h2>
        <p className="mt-4 line-clamp-4 font-serif text-lg text-ink/80">{post.dek}</p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ink/50">{post.authorName} · {fmtDate(post.publishedAt)}</p>
      </div>
    </Link>
  );
}

export function StackCard({ post }: { post: P }) {
  return (
    <Link href={`/story/${post.slug}`} className="group grid grid-cols-[1fr_120px] gap-4 border-t border-ink/15 py-4 first:border-t-0 first:pt-0">
      <div>
        <Kicker post={post} />
        <h3 className="hed mt-1 text-xl group-hover:text-accent">{post.title}</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink/50">{post.authorName}</p>
      </div>
      <Img post={post} className="aspect-[40/21] self-start" />
    </Link>
  );
}

export async function GridCard({ post }: { post: P }) {
  const { t, date: fmtDate } = await getI18n();
  return (
    <Link href={`/story/${post.slug}`} className="group block">
      <Img post={post} className="aspect-[40/21]" />
      <div className="mt-3">
        <Kicker post={post} />
        <h3 className="hed mt-1 text-2xl group-hover:underline decoration-2 underline-offset-2">{post.title}</h3>
        <p className="mt-2 line-clamp-2 font-serif text-base text-ink/70">{post.dek}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">{fmtDate(post.publishedAt)} · {t("minShort", { n: post.readMinutes })}</p>
      </div>
    </Link>
  );
}

export function NumberedList({ posts, title }: { posts: P[]; title: string }) {
  return (
    <section>
      <h2 className="hed rule pt-3 text-3xl">{title}</h2>
      <ol className="mt-4">
        {posts.map((p, i) => (
          <li key={p.id} className="border-t border-ink/15 py-4 first:border-t-0">
            <Link href={`/story/${p.slug}`} className="group grid grid-cols-[44px_1fr] gap-3">
              <span className="font-display text-4xl font-extrabold leading-none text-accent">{i + 1}</span>
              <span>
                <Kicker post={p} />
                <span className="hed mt-1 block text-xl group-hover:underline">{p.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
