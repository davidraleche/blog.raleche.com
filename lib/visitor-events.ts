import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { getUser } from "./auth";

export type EventIn = { kind: string; detail: string; amount?: number | null; correct?: boolean | null; path?: string };

/**
 * Add a step to the visitor's history (signed in or not). Only visitors with a visitor cookie are recorded
 * (the page-view beacon sets it and skips bots); admins are not tracked. Never throws.
 */
export async function recordEvent(e: EventIn) {
  try {
    const [jar, h, user] = await Promise.all([cookies(), headers(), getUser()]);
    if (user?.role === "ADMIN") return;
    const visitorId = jar.get("vid")?.value;
    if (!visitorId || !/^[\w-]{10,40}$/.test(visitorId)) return;
    let path = e.path;
    if (!path) try { path = new URL(h.get("referer") ?? "").pathname; } catch { path = ""; }
    await db.visitorEvent.create({
      data: { visitorId, sessionId: jar.get("vsid")?.value ?? null, userId: user?.id ?? null, kind: e.kind.slice(0, 30), path: (path ?? "").slice(0, 300), detail: e.detail.slice(0, 500), amount: e.amount ?? null, correct: e.correct ?? null },
    });
  } catch (err) {
    console.error("[events]", (err as Error).message);
  }
}
