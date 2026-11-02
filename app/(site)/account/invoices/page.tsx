import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "Invoices" };

const STATUS: Record<string, string> = { paid: "Paid", open: "Due", void: "Void", uncollectible: "Unpaid", draft: "Draft" };

export default async function Invoices() {
  const user = await requireUser("/account/invoices");
  const invoices = stripe && user.stripeCustomerId
    ? (await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 36 }).catch(() => null))?.data.filter((i) => i.status !== "draft") ?? []
    : [];

  if (!invoices.length) {
    return (
      <div className="border-[3px] border-ink p-6">
        <p className="kicker">Invoices</p>
        <p className="mt-3 font-serif text-lg">No invoices yet.</p>
        <Link href="/membership" className="btn-dark mt-6">See membership plans</Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b-[3px] border-ink font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">
          <tr><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Invoice</th><th className="py-3 pr-4">Description</th><th className="py-3 pr-4 text-right">Amount</th><th className="py-3 pr-4">Status</th><th className="py-3" /></tr>
        </thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className="border-b border-ink/15">
              <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(new Date(i.created * 1000))}</td>
              <td className="py-3 pr-4 font-mono text-xs">{i.number}</td>
              <td className="py-3 pr-4">{i.lines.data[0]?.description?.replace(/^1 × /, "") ?? "Membership"}</td>
              <td className="py-3 pr-4 text-right font-mono">{money(i.total)}</td>
              <td className="py-3 pr-4"><span className={`font-mono text-[11px] uppercase tracking-widest ${i.status === "paid" ? "text-terminal-up" : "text-accent"}`}>{STATUS[i.status ?? ""] ?? i.status}</span></td>
              <td className="py-3 whitespace-nowrap text-right">
                {i.hosted_invoice_url && <a href={i.hosted_invoice_url} target="_blank" rel="noreferrer" className="font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">View</a>}
                {i.invoice_pdf && <a href={i.invoice_pdf} className="ml-4 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline">PDF</a>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-ink/50">Receipts are also emailed to you after each payment.</p>
    </div>
  );
}
