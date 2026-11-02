import crypto from "crypto";

// Firebase Hosting drops every cookie except __session, so the OAuth state is signed and carried in the URL instead of a cookie.
const key = () => process.env.SESSION_SECRET || "dev-secret";
const sign = (body: string) => crypto.createHmac("sha256", key()).update(body).digest("base64url");

export function makeState(next: string) {
  const body = Buffer.from(JSON.stringify({ n: crypto.randomBytes(8).toString("hex"), next, exp: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the post-login path if the state is genuine and fresh, otherwise null. */
export function readState(state: string | null): { next: string } | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig || sig.length !== sign(body).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof v.exp === "number" && v.exp > Date.now() ? { next: String(v.next ?? "/") } : null;
  } catch { return null; }
}
