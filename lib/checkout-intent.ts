// What a reader was trying to do when they ran out of tokens, carried through Stripe Checkout in the session metadata.
export type Then = { kind: "unlock"; postId: string; anchor: "quiz" | "summary" } | { kind: "memo"; memoId: string };

/** A same-site path to send the reader back to (never another site). */
export const safeNext = (s: unknown) => (typeof s === "string" && /^\/(?!\/)[\w\-./%]*$/.test(s) && s.length <= 300 ? s : null);

export function parseThen(s: unknown): Then | null {
  if (typeof s !== "string") return null;
  let m = s.match(/^unlock:([\w-]{1,64}):(quiz|summary)$/);
  if (m) return { kind: "unlock", postId: m[1], anchor: m[2] as "quiz" | "summary" };
  m = s.match(/^memo:([\w-]{1,64})$/);
  if (m) return { kind: "memo", memoId: m[1] };
  return null;
}
