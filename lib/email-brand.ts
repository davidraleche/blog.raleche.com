// The RALECHE logo at the top of emails. No server-only imports, so scripts can render emails too.
// public/email/raleche-logo.png is the site's logo (components/Logo.tsx) as a picture: mail apps can't draw the
// letter boxes or show SVG. It is 616×112 and shown at half size, so it stays sharp on high-density screens.

import { NO_COMMUNITY } from "./community-email";

const siteUrl = () => (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");
const LOGO_FILE = "/email/raleche-logo.png";

/** The logo, linked to the site. */
export function emailLogo(width = 242) {
  const url = siteUrl();
  const height = Math.round((width * 112) / 616);
  return `<a href="${url}" style="text-decoration:none;display:inline-block"><img src="${url}${LOGO_FILE}" width="${width}" height="${height}" alt="RALECHE" style="display:block;border:0;width:${width}px;height:${height}px;font-family:Arial,sans-serif;font-weight:800;font-size:28px;color:#111"></a>`;
}

/** The email with the logo on top, unless it already has it or opted out (alerts to the admin). */
export function withLogo(html: string) {
  if (html.includes(LOGO_FILE) || html.includes(NO_COMMUNITY)) return html;
  return `<div style="max-width:600px;margin:0 auto;padding:16px 20px;border-bottom:3px solid #111">${emailLogo()}</div>${html}`;
}
