import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";

export const metadata = { title: "Executive summaries" };

/** The executive summaries this member unlocked, plus any PDF memo bought before summaries replaced memos. */
export default async function MySummaries({ searchParams }: { searchParams: Promise<{ bought?: string }> }) {
  const { bought } = await searchParams;
  const user = await requireUser("/account/memos");
  const { locale, t, date } = await getI18n();
  const [unlocks, purchases] = await Promise.all([
    db.unlock.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, post: { select: { id: true, slug: true, title: true, dek: true } } } }),
    db.memoPurchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, memo: { select: { id: true, title: true, summary: true, fileSize: true, post: { select: { slug: true } } } } },
    }),
  ]);
  const summaries = await localizeFields(locale, unlocks.map((u) => ({ ...u.post, at: u.createdAt })), ["title", "dek"]);
  const memos = await localizeFields(locale, purchases.map((p) => ({ ...p.memo, boughtAt: p.createdAt })), ["title", "summary"]);

  if (!summaries.length && !memos.length) {
    return (
      <div className="border-[3px] border-ink p-6">
        <p className="kicker">{t("tabMemos")}</p>
        <p className="mt-3 font-serif text-lg">{t("myMemosEmpty")}</p>
        <Link href="/memos" className="btn-dark mt-6">{t("browseMemos")}</Link>
      </div>
    );
  }

  return (
    <div>
      {bought && <p className="mb-8 bg-ink px-5 py-4 font-mono text-sm text-terminal-up">✓ {t("memoBought")}</p>}
      <div className="border-t-[3px] border-ink">
        {summaries.map((s) => (
          <div key={s.id} className="grid gap-4 border-b border-ink/15 py-6 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="hed text-2xl"><Link href={`/story/${s.slug}`} className="hover:text-accent">{s.title}</Link></h2>
              {s.dek && <p className="mt-2 font-serif text-ink/70">{s.dek}</p>}
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">{t("memoBoughtOn", { date: date(s.at) })}</p>
            </div>
            <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">
              <Link href={`/story/${s.slug}#summary`} className="btn-dark">{t("memoRead")}</Link>
              <a href={`/story/${s.slug}/summary.pdf`} className="btn-light">{t("memoDownload")}</a>
            </div>
          </div>
        ))}
        {memos.map((m) => (
          <div key={m.id} className={`grid gap-4 border-b border-ink/15 py-6 sm:grid-cols-[1fr_auto] ${bought === m.id ? "bg-accent/5 px-3" : ""}`}>
            <div>
              <h2 className="hed text-2xl">{m.title}</h2>
              {m.summary && <p className="mt-2 font-serif text-ink/70">{m.summary}</p>}
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink/50">
                {t("memoBoughtOn", { date: date(m.boughtAt) })}
                {m.post && <> · <Link href={`/story/${m.post.slug}`} className="text-accent hover:underline">{t("readArticle")}</Link></>}
              </p>
            </div>
            {m.fileSize ? (
              <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">
                <a href={`/memos/${m.id}/file`} target="_blank" rel="noopener" className="btn-dark">{t("memoRead")}</a>
                <a href={`/memos/${m.id}/file?download=1`} className="btn-light">{t("memoDownload")}</a>
              </div>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">{t("memoSoon")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
