import "server-only";
import geoip from "geoip-country";

/** The visitor's IP: the first address in X-Forwarded-For (set by Cloud Run), else X-Real-IP. */
export function clientIp(h: Headers): string | null {
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return ip || null;
}

/** Two-letter country code for an IP, from a geo database bundled with the site (no outside lookup). */
export function countryOf(ip: string | null): string | null {
  if (!ip) return null;
  try {
    return geoip.lookup(ip)?.country ?? null;
  } catch {
    return null;
  }
}

/** "France 🇫🇷" from "FR". */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "unknown country";
  let name = code;
  try { name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch {}
  const flag = /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";
  return `${name}${flag ? ` ${flag}` : ""}`;
}
