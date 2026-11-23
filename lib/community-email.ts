// "Join the WhatsApp group / connect on LinkedIn" block added to every email sent to readers (see lib/email.ts).
// No server-only imports, so scripts can render it too.
import type { Locale } from "./i18n/messages";

export const WHATSAPP_URL = "https://chat.whatsapp.com/GIMLmFqAIXy4UeFR0SqJQE?mode=gi_t";
export const LINKEDIN_URL = "https://www.linkedin.com/in/davidraleche/";

/** Where a template wants the block: in a div layout, or as a row of a table layout. Without either, it goes at the end. */
export const COMMUNITY_SLOT = "<!--community-->";
export const COMMUNITY_ROW_SLOT = "<!--community-row-->";
/** Put this in an email that must not carry the block (alerts to the admin). */
export const NO_COMMUNITY = "<!--no-community-->";

const TEXT: Record<Locale, { title: string; whatsapp: string; join: string; linkedin: string; connect: string }> = {
  en: {
    title: "Join the community",
    whatsapp: "Here is the link to our WhatsApp group. It's where most of our conversations happen. If you join, please introduce yourself.",
    join: "Join the WhatsApp group",
    linkedin: "If you'd like to connect with me on LinkedIn, here is my profile:",
    connect: "Connect on LinkedIn",
  },
  fr: {
    title: "Rejoignez la communauté",
    whatsapp: "Voici le lien vers notre groupe WhatsApp. C'est là que se passent la plupart de nos échanges. Si vous nous rejoignez, présentez-vous en quelques mots.",
    join: "Rejoindre le groupe WhatsApp",
    linkedin: "Si vous souhaitez vous connecter avec moi sur LinkedIn, voici mon profil :",
    connect: "Se connecter sur LinkedIn",
  },
  es: {
    title: "Únete a la comunidad",
    whatsapp: "Aquí tienes el enlace a nuestro grupo de WhatsApp. Es donde ocurren la mayoría de nuestras conversaciones. Si te unes, preséntate.",
    join: "Unirme al grupo de WhatsApp",
    linkedin: "Si quieres conectar conmigo en LinkedIn, este es mi perfil:",
    connect: "Conectar en LinkedIn",
  },
  zh: {
    title: "加入社区",
    whatsapp: "这是我们 WhatsApp 群组的链接，我们大部分的交流都在这里进行。加入后请做个自我介绍。",
    join: "加入 WhatsApp 群组",
    linkedin: "如果您想在 LinkedIn 上与我联系，这是我的主页：",
    connect: "在 LinkedIn 上联系",
  },
};

export function communityBlock(lang: Locale = "en") {
  const t = TEXT[lang] ?? TEXT.en;
  const btn = (bg: string) =>
    `display:inline-block;background:${bg};color:#fff;padding:10px 16px;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:.5px`;
  return `<div style="max-width:560px;margin:24px auto 0;padding:18px 20px;border:2px solid #111;background:#fafafa;font-family:Georgia,serif;font-size:15px;line-height:1.55;color:#111">
<div style="font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#d6261c;margin-bottom:8px">${t.title}</div>
<p style="margin:0 0 10px">${t.whatsapp}</p>
<p style="margin:0 0 16px"><a href="${WHATSAPP_URL}" style="${btn("#1f9d55")}">${t.join}</a></p>
<p style="margin:0 0 10px">${t.linkedin}</p>
<p style="margin:0 0 12px"><a href="${LINKEDIN_URL}" style="${btn("#0a66c2")}">${t.connect}</a></p>
<p style="margin:0;font-style:italic;color:#555">David Raleche</p>
</div>`;
}

/** The email with the block in its slot (or at the end), after `before` (the books box); unchanged if it opted out. */
export function withCommunity(html: string, lang: Locale = "en", before = "") {
  if (html.includes(NO_COMMUNITY)) return html;
  const block = before + communityBlock(lang);
  if (html.includes(COMMUNITY_SLOT)) return html.replace(COMMUNITY_SLOT, block);
  if (html.includes(COMMUNITY_ROW_SLOT)) return html.replace(COMMUNITY_ROW_SLOT, `<tr><td style="padding:0 20px 8px">${block}</td></tr>`);
  return html + block;
}
