/**
 * Where a visit comes from. Links we share carry ?source=<name> (e.g. raleche.com/story/x?source=linkedin);
 * utm_source works too. Without a tag, the referrer's site is used (t.co → twitter, google.* → google…).
 */

/** Short names people may type in a link, mapped to one name per network. */
const ALIASES: Record<string, string> = {
  x: "twitter", tw: "twitter", "x.com": "twitter", "twitter.com": "twitter",
  li: "linkedin", lnkd: "linkedin",
  fb: "facebook", meta: "facebook",
  ig: "instagram", insta: "instagram",
  yt: "youtube", shorts: "youtube", "youtube-shorts": "youtube",
  tt: "tiktok",
  wa: "whatsapp",
  mail: "email", newsletter: "email",
};

/** A ?source= / utm_source value made safe for storage (lowercase, letters, digits, - and _), or null. */
export function cleanSource(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  if (!s) return null;
  return ALIASES[s] ?? s;
}

const HOSTS: [RegExp, string][] = [
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "twitter"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(reddit\.com|redd\.it)$/, "reddit"],
  [/(^|\.)news\.ycombinator\.com$/, "hackernews"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(threads\.net|threads\.com)$/, "threads"],
  [/(^|\.)bsky\.app$/, "bluesky"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)tech-team-strategy\.com$/, "tech-team-strategy"],
];

/** The source for an outside referrer like "t.co/abc" or "www.linkedin.com/feed/" (host + path, no scheme). */
export function sourceFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const host = referrer.split("/")[0].toLowerCase().replace(/^www\.|^m\.|^l\.|^lm\./, "");
  for (const [re, name] of HOSTS) if (re.test(host)) return name;
  return host || null;
}

/** Visits from links we tag ourselves (shown first in the dashboard). */
export const SOCIAL_SOURCES = ["twitter", "linkedin", "facebook", "instagram", "tiktok", "youtube"];
