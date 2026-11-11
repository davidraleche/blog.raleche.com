import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { translateMany } from "@/lib/translate";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { money } from "@/lib/utils";
import { db } from "@/lib/db";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const user = await requireUser("/account/invoices");
  const { locale, t, date: fmtDate } = await getI18n();
  const status = (s: string | null) => (["paid", "open", "void", "uncollectible", "draft"].includes(s ?? "") ? t(`inv_${s}` as keyof Messages) : s);
  const invoices = stripe && user.stripeCustomerId
    ? (await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 36 }).catch(() => null))?.data.filter((i) => i.status !== "draft") ?? []
    : [];
  const txns = await db.tokenTxn.findMany({ where: { userId: user.id, reason: { not: "share_ip" } }, orderBy: { createdAt: "desc" }, take: 100 });
  const notes = await translateMany(locale, txns.map((x) => x.note ?? ""));
  const history = <TokenHistory txns={txns} notes={notes} balance={user.tokenBalance} t={t} fmtDate={fmtDate} />;

  if (!invoices.length) {
    return (
      <div className="space-y-10">
      <div className="border-[3px] border-ink p-6">
        <p className="kicker">{t("tabInvoices")}</p>
        <p className="mt-3 font-serif text-lg">{t("noInvoices")}</p>
        <Link href="/store" className="btn-dark mt-6">{t("getTokens")}</Link>
      </div>
      {history}
      </div>
    );
  }

  const descriptions = await translateMany(locale, invoices.map((i) => i.lines.data[0]?.description?.replace(/^1 × /, "") ?? t("membership")));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b-[3px] border-ink font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
          <tr><th className="py-3 pr-4">{t("colDate")}</th><th className="py-3 pr-4">{t("colInvoice")}</th><th className="py-3 pr-4">{t("colDescription")}</th><th className="py-3 pr-4 text-right">{t("colAmount")}</th><th className="py-3 pr-4">{t("colStatus")}</th><th className="py-3" /></tr>
        </thead>
        <tbody>
          {invoices.map((i, n) => (
            <tr key={i.id} className="border-b border-ink/15">
              <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(new Date(i.created * 1000))}</td>
              <td className="py-3 pr-4 font-mono text-xs">{i.number}</td>
              <td className="py-3 pr-4">{descriptions[n]}</td>
              <td className="py-3 pr-4 text-right font-mono">{money(i.total)}</td>
              <td className="py-3 pr-4"><span className={`font-mono text-[11px] uppercase tracking-widest ${i.status === "paid" ? "text-terminal-up" : "text-accent"}`}>{status(i.status)}</span></td>
              <td className="py-3 whitespace-nowrap text-right">
                {i.hosted_invoice_url && <a href={i.hosted_invoice_url} target="_blank" rel="noreferrer" className="font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">{t("view")}</a>}
                {i.invoice_pdf && <a href={i.invoice_pdf} className="ml-4 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">PDF</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-ink/50">{t("receiptsNote")}</p>
      <div className="mt-10">{history}</div>
    </div>
  );
}

/** Every token earned or spent (share rewards, quizzes, spins, purchases, unlocks), newest first. */
function TokenHistory({ txns, notes, balance, t, fmtDate }: {
  txns: { id: string; amount: number; reason: string; createdAt: Date }[]; notes: string[]; balance: number;
  t: Awaited<ReturnType<typeof getI18n>>["t"]; fmtDate: Awaited<ReturnType<typeof getI18n>>["date"];
}) {
  return (
    <section id="tokens" className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-ink pb-2">
        <h2 className="hed text-3xl">{t("tokenHistory")}</h2>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink/60">{t("youHaveTokens", { n: balance })}</span>
      </div>
      <p className="mt-2 font-serif text-sm text-ink/60">{t("tokenHistoryDek")}</p>
      {txns.length === 0 ? (
        <p className="mt-4 font-serif text-ink/60">{t("noActivity")}</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <tbody>
            {txns.map((x, i) => (
              <tr key={x.id} className={`border-b border-ink/15 ${x.reason === "share" ? "bg-terminal-amber/10" : ""}`}>
                <td className="py-2 pr-4 align-top whitespace-nowrap font-mono text-xs text-ink/50">{fmtDate(x.createdAt)}</td>
                <td className="py-2 pr-4">
                  {t(`txn_${x.reason}` as keyof Messages) || x.reason}
                  {notes[i] && <span className="block font-serif text-xs text-ink/60">{notes[i]}</span>}
                </td>
                <td className={`py-2 text-right align-top font-mono font-bold whitespace-nowrap ${x.amount >= 0 ? "text-green-700" : "text-accent"}`}>{x.amount >= 0 ? "+" : ""}{x.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
