import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { localizePosts } from "@/lib/localize";
import { personSlug } from "@/lib/people";
import { GridCard } from "@/components/Cards";

/** Published stories grouped by speaker or host, people with the most stories first. */
export async function PeopleIndex({ by }: { by: "speaker" | "host" }) {
  const { locale, t } = await getI18n();
  const raw = await db.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() }, [by]: { not: null } },
    include: { category: true },
    orderBy: { publishedAt: "desc" },
  });
  const posts = await localizePosts(locale, raw);
  const groups = new Map<string, typeof posts>();
  for (const p of posts) groups.set(p[by]!, [...(groups.get(p[by]!) ?? []), p]);
  const people = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="hed border-b-[3px] border-ink pb-4 text-7xl sm:text-9xl">{t(by === "speaker" ? "speakers" : "hosts")}</h1>
      <p className="mt-4 max-w-2xl font-serif text-xl text-ink/70">{t(by === "speaker" ? "speakersIntro" : "hostsIntro")}</p>

      {!people.length && <p className="py-16 font-serif text-xl text-ink/60">{t("noStoriesSection")}</p>}

      {people.length > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2">
          {people.map(([name, ps]) => (
            <a key={name} href={`#${personSlug(name)}`} className="border border-ink/30 px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:bg-ink hover:text-white">
              {name} <span className="text-ink/40">{ps.length}</span>
            </a>
          ))}
        </nav>
      )}

      {people.map(([name, ps]) => {
        const show = by === "host" ? ps.find((p) => p.show)?.show : null;
        return (
          <section key={name} id={personSlug(name)} className="scroll-mt-24 py-10">
            <div className="rule flex flex-wrap items-baseline justify-between gap-2 pt-3">
              <h2 className="hed text-4xl">{name}</h2>
              {show && <span className="kicker">{show}</span>}
            </div>
            <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{ps.map((p) => <GridCard key={p.id} post={p} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
