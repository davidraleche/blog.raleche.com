import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getUser, canReadSummaries } from "./auth";

export const AD_KEYS = ["adsenseClient", "adSlotFeed", "adSlotArticleTop", "adSlotArticleEnd", "adsHideForMembers"] as const;

/** AdSense config for the current visitor, or null when ads shouldn't show. */
export const adsConfig = cache(async () => {
  const rows = await db.setting.findMany({ where: { key: { in: [...AD_KEYS] } } });
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const client = s.adsenseClient?.trim();
  if (!client?.startsWith("ca-pub-")) return null;
  if (s.adsHideForMembers !== "off" && canReadSummaries(await getUser())) return null;
  return { client, slots: { feed: s.adSlotFeed?.trim(), articleTop: s.adSlotArticleTop?.trim(), articleEnd: s.adSlotArticleEnd?.trim() } };
});
export type AdSlotName = keyof NonNullable<Awaited<ReturnType<typeof adsConfig>>>["slots"];
