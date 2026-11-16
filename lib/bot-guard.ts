import "server-only";
import { headers } from "next/headers";
import { clientIp } from "./geo";

/**
 * Bot traps for the newsletter box and email sign-up (see components/BotTrap.tsx for the form side):
 *  - honeypot: a hidden "website" field people never see; bots that fill every field fill it
 *  - "ready" field: set by the page's script 2 s after the form appears, so bots that post the form
 *    without running scripts, or submit it instantly, send it empty
 *  - rate limit per IP address: 3 sign-ups an hour, 8 a day (kept in memory, per server instance)
 */

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const hits = new Map<string, number[]>();

function overLimit(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < DAY);
  const over = recent.filter((t) => now - t < HOUR).length >= 3 || recent.length >= 8;
  if (!over) recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < DAY)) hits.delete(k);
  return over;
}

/** "bot" (pretend it worked), "limit" (tell them to try later) or null (let it through). */
export async function checkSignupBot(form: FormData, kind: string): Promise<"bot" | "limit" | null> {
  const ip = clientIp(await headers()) ?? "unknown";
  if (String(form.get("website") ?? "").trim() || form.get("ready") !== "1") {
    console.warn(`[bot-guard] ${kind}: blocked a bot (${form.get("website") ? "honeypot" : "no script / too fast"}) from ${ip}`);
    return "bot";
  }
  if (ip !== "unknown" && overLimit(ip)) {
    console.warn(`[bot-guard] ${kind}: rate limit for ${ip}`);
    return "limit";
  }
  return null;
}
