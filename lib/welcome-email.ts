// Welcome email for new newsletter subscribers. No server-only imports, so scripts can render it too.
import { messages, fmt, type Locale } from "./i18n/messages";

type Story = { title: string; slug: string; dek?: string | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function welcomeEmail({ locale, unsubscribeKey, stories }: { locale: Locale; unsubscribeKey?: string; stories: Story[] }) {
  const m = messages[locale];
  const url = (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
  const list = stories
    .map(
      (s) => `<tr><td style="padding:12px 0;border-top:1px solid #e5e5e5">
<a href="${url}/story/${encodeURIComponent(s.slug)}" style="color:#111;text-decoration:none;font-weight:bold;font-size:18px;line-height:1.3">${esc(s.title)}</a>
${s.dek ? `<div style="color:#555;font-size:15px;margin-top:4px">${esc(s.dek)}</div>` : ""}</td></tr>`,
    )
    .join("");
  const html = `<div style="max-width:600px;margin:auto;font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#111">
<div style="background:#000;color:#fff;padding:16px 20px;font-family:Arial Narrow,Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:2px">RALECHE</div>
<div style="padding:20px">
<h1 style="font-size:26px;margin:0 0 12px">${esc(m.welcomeHeading)}</h1>
<p style="margin:0 0 24px">${esc(m.welcomeBody)}</p>
${stories.length ? `<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:4px">${esc(m.welcomeLatest)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${list}</table>` : ""}
<p style="margin:28px 0 0"><a href="${url}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;letter-spacing:1px">${esc(m.welcomeCta)}</a></p>
</div>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#888;padding:16px 20px 0;border-top:1px solid #e5e5e5;margin:24px 20px 0 20px">${esc(m.welcomeFooter)}<br><a href="${url}/unsubscribe?key=${encodeURIComponent(unsubscribeKey ?? "test")}" style="color:#555;text-decoration:underline">${esc(m.unsubscribe)}</a></p></div>`;
  return { subject: fmt(m.welcomeSubject), html };
}
