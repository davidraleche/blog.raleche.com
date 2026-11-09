import { TOKEN_PACKS } from "./token-config";
import { money } from "./utils";
import type { getI18n } from "./i18n/server";

type T = Awaited<ReturnType<typeof getI18n>>["t"];

/** Props for the "not enough tokens" popup, shared by the story and memo pages. */
export const topUpPacks = () => TOKEN_PACKS.map((p) => ({ id: p.id, tokens: p.tokens, price: money(p.cents) }));
export const topUpLabels = (t: T) =>
  Object.fromEntries((["topUpTitle", "topUpNeed", "topUpDetail", "topUpBest", "topUpSecure", "tokensLabel", "close"] as const).map((k) => [k, t(k, { b: "{b}", n: "{n}", s: "{s}" })]));
