import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { localizeFields } from "@/lib/localize";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { isFreeMemo, memoListSelect } from "@/lib/memos";
import { buyMemo } from "@/app/actions/memos";
import { TopUpDialog } from "@/components/TopUpDialog";
import { topUpLabels, topUpPacks } from "@/lib/topup";
import { BCP47 } from "@/lib/i18n/messages";

export const metadata = {
  title: "Buy Memo",
  description: "In-depth memos on the interviews that matter: key numbers, themes, an action checklist and a 30-60-90 day plan. Pay with tokens.",
  alternates: { canonical: "/memos" },
};

export default async function Memos({ searchParams }: { searchParams: Promise<{ error?: string; topup?: string }> }) {
  const { locale, t } = await getI18n();
  const { error, topup } = await searchParams;
  const user = await getUser();
  const [rawMemos, owned] = await Promise.all([
    db.memo.findMany({ where: { active: true }, select: memoListSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    user ? db.memoPurchase.findMany({ where: { userId: user.id }, select: { memoId: true } }) : [],
  ]);
  // Free samples first, so readers can see what a memo looks like before buying one.
  const memos = (await localizeFields(locale, rawMemos, ["title", "summary"])).sort((a, b) => Number(isFreeMemo(b)) - Number(isFreeMemo(a)));
  const ownedIds = new Set(owned.map((o) => o.memoId));
  const n = (v: number) => v.toLocaleString(BCP47[locale]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="kicker">{t("memoKicker")}</p>
        <h1 className="hed mx-auto mt-3 max-w-4xl text-6xl sm:text-8xl">{t("memoTitle")}</h1>
        <p className="mx-auto mt-6 max-w-2xl font-serif text-xl text-ink/70">{t("memoIntro")}</p>
        {user && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
            {t("memoBalance", { n: n(user.tokenBalance) })} · <Link href="/store" className="text-accent hover:underline">{t("getTokens")}</Link>
          </p>
        )}
      </div>

      {(() => {
        const want = user && topup ? memos.find((m) => m.id === topup && !ownedIds.has(m.id) && m.fileSize) : null;
        return want && user ? <TopUpDialog packs={topUpPacks()} balance={user.tokenBalance} cost={want.priceTokens} next="/memos" then={`memo:${want.id}`} labels={topUpLabels(t)} /> : null;
      })()}
      {error === "unavailable" && <p className="mx-auto mt-8 max-w-2xl border-l-4 border-accent bg-accent/5 px-4 py-3 text-sm">{t("memoUnavailable")}</p>}

      {memos.length ? (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {memos.map((m) => {
            const mine = ownedIds.has(m.id);
            const onSale = !!m.fileSize;
            const free = onSale && isFreeMemo(m);
            return (
              <div key={m.id} id={m.slug} className={`relative flex scroll-mt-24 flex-col border-[3px] target:ring-4 target:ring-accent ${free ? "border-terminal-amber shadow-[6px_6px_0_#f5a623]" : "border-ink"}`}>
                {free && <span className="absolute left-3 top-3 z-10 bg-terminal-amber px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink shadow">{t("memoFreeBadge")}</span>}
                {m.post?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.post.coverImage} alt="" className="aspect-[1200/630] w-full border-b-[3px] border-ink object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-[1200/630] items-center justify-center border-b-[3px] border-ink bg-ink font-display text-5xl font-extrabold text-white/20">R</div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="hed text-2xl">{m.title}</h2>
                  <p className="mt-2 flex-1 font-serif text-ink/70">{m.summary}</p>
                  <p className="mt-4 font-display text-3xl font-extrabold">{free ? t("memoFree") : onSale ? t("memoPrice", { n: n(m.priceTokens) }) : t("memoSoon")}</p>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                    {free ? (
                      <a href={`/memos/${m.id}/file`} target="_blank" rel="noopener" className="bg-terminal-amber px-4 py-2 font-bold text-ink hover:bg-ink hover:text-white">{t("memoReadFree")}</a>
                    ) : mine ? (
                      <Link href="/account/memos" className="bg-ink px-4 py-2 text-white hover:bg-accent">{t("memoOpen")}</Link>
                    ) : onSale ? (
                      <form action={buyMemo}>
                        <input type="hidden" name="memoId" value={m.id} />
                        <button className="bg-ink px-4 py-2 uppercase text-white hover:bg-accent">{user ? t("memoBuy", { n: n(m.priceTokens) }) : t("memoSignIn")}</button>
                      </form>
                    ) : null}
                    {m.post && <Link href={`/story/${m.post.slug}`} className="border border-ink px-4 py-2 hover:bg-ink hover:text-white">{t("readArticle")}</Link>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-12 text-center font-serif text-xl text-ink/70">{t("memoNone")}</p>
      )}
    </div>
  );
}
