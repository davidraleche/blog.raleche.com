import "server-only";
import type Stripe from "stripe";
import { db } from "./db";
import { stripe } from "./stripe";
import { sendEmail } from "./email";
import { invoiceEmail, invoicePdf } from "./invoice";
import { LOCALES, type Locale } from "./i18n/messages";

const brand = (b: string) => b.charAt(0).toUpperCase() + b.slice(1);

/**
 * Email a branded invoice (PDF attached) for a paid token checkout. Called once per purchase, right after the
 * tokens are credited. Never throws: a failed email must not undo or block the purchase.
 */
export async function sendPurchaseInvoice(sessionId: string, userId: string, tokens: number) {
  try {
    if (!stripe) return;
    const s = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["invoice", "payment_intent.payment_method"] });
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, language: true, tokenBalance: true } });
    const to = user?.email || s.customer_details?.email;
    if (!to) return; // phone-only member with no email at checkout

    const invoice = s.invoice && typeof s.invoice === "object" ? (s.invoice as Stripe.Invoice) : null;
    const pi = s.payment_intent && typeof s.payment_intent === "object" ? (s.payment_intent as Stripe.PaymentIntent) : null;
    const pm = pi?.payment_method && typeof pi.payment_method === "object" ? (pi.payment_method as Stripe.PaymentMethod) : null;
    const card = pm?.card ? `${brand(pm.card.brand)} •••• ${pm.card.last4}` : pm?.type ? brand(pm.type.replace(/_/g, " ")) : null;
    const locale: Locale = (LOCALES as readonly string[]).includes(user?.language ?? "") ? (user!.language as Locale) : "en";

    const data = {
      number: invoice?.number || `RAL-${s.id.slice(-10).toUpperCase()}`,
      paidAt: new Date((s.created ?? Date.now() / 1000) * 1000),
      locale,
      customerName: user?.name || s.customer_details?.name || null,
      customerEmail: to,
      tokens,
      amountCents: s.amount_total ?? tokens,
      currency: s.currency ?? "usd",
      card,
      balance: user?.tokenBalance,
    };
    const pdf = await invoicePdf(data);
    const { subject, html, filename } = invoiceEmail(data);
    const ok = await sendEmail(to, subject, html, [{ filename, content: pdf }]);
    if (!ok) console.error(`[invoice] email to ${to} for ${s.id} was not accepted`);
  } catch (e) {
    console.error("[invoice] could not send:", (e as Error)?.message);
  }
}
