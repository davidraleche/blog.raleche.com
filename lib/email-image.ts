// Story covers in emails. No server-only imports, so scripts can render emails too.
// Covers go through raleche.com's image resizer, so an email loads a
// ~60 KB picture instead of the ~800 KB original; it answers PNG/JPEG to mail apps that can't show WebP.

const siteUrl = () => (process.env.APP_URL || "https://raleche.com").replace(/\/$/, "");

/** Absolute URL of a cover, resized to width w (in pixels). */
export function emailImage(src: string | null | undefined, w: 128 | 256 | 384 | 640 | 750 | 828 | 1080 = 640) {
  if (!src) return null;
  const url = siteUrl();
  // Our own covers by path; covers hosted elsewhere (e.g. tech-team-strategy.com) by full URL. Both come back
  // resized from raleche.com (next.config.mjs allows any https image host).
  const own = src.startsWith("/") ? src : src.startsWith(url) ? src.slice(url.length) || "/" : /^https:\/\//.test(src) ? src : null;
  if (own === null) return null;
  return `${url}/_next/image?url=${encodeURIComponent(own)}&w=${w}&q=75`;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A linked cover image for an email, full width (560 px) or a thumbnail of the given width. */
export function emailCover(src: string | null | undefined, href: string, width = 560, alt = "") {
  const img = emailImage(src, width > 300 ? 640 : 256);
  if (!img) return "";
  return `<a href="${attr(href)}" style="text-decoration:none"><img src="${attr(img)}" width="${width}" alt="${attr(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0"></a>`;
}
