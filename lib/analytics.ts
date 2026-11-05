import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getUser } from "./auth";

/** GA4 measurement ID from admin settings, or null when unset. Admins aren't tracked so their visits don't skew the numbers. */
export const analyticsId = cache(async () => {
  const id = (await db.setting.findUnique({ where: { key: "gaMeasurementId" } }))?.value.trim();
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return null;
  if ((await getUser())?.role === "ADMIN") return null;
  return id;
});
