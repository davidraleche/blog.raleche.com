import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { translateMany } from "@/lib/translate";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { money } from "@/lib/utils";

export const metadata = { title: "Invoices" };

export default async function Invoices() {
  const user = await requireUser("/account/invoices");
  const { locale, t, date: fmtDate } = await getI18n();
  const status = (s: string | null) => (["paid", "open", "void", "uncollectible", "draft"].includes(s ?? "") ? t(`inv_${s}` as keyof Messages) : s);
  const invoices = stripe && user.stripeCustomerId
    ? (await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 36 }).catch(() => null))?.data.filter((i) => i.status !== "draft") ?? []
    : [];

  if (!invoices.length) {
    return (
      <div className="border-[3px] border-ink p-6">
        <p className="kicker">{t("tabInvoices")}</p>
        <p className="mt-3 font-serif text-lg">{t("noInvoices")}</p>
        <Link href="/store" className="btn-dark mt-6">{t("getTokens")}</Link>
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
    </div>
  );
}
