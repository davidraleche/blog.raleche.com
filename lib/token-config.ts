// Token economy settings. Safe to import from browser code.
/** $1 = 100 tokens. */
export const TOKENS_PER_DOLLAR = 100;
/** Price to unlock one executive summary. */
export const UNLOCK_COST = 100;
/** Default price of an in-depth memo. Each memo can override it in the admin. */
export const MEMO_COST = 100;
/** Earned once per article for voting in its poll, and once for commenting on it. */
export const PARTICIPATION_REWARD = 10;
/** Earned by getting both quiz questions on an article right (one try per article). */
export const QUIZ_REWARD = 10;
export const POLL_CHOICES = ["great", "average", "not_great"] as const;

export const TOKEN_PACKS = [
  { id: "t100", cents: 100, tokens: 100 },
  { id: "t500", cents: 500, tokens: 500 },
  { id: "t1000", cents: 1000, tokens: 1000 },
] as const;
export type TokenPack = (typeof TOKEN_PACKS)[number];
export const findPack = (id: string) => TOKEN_PACKS.find((p) => p.id === id);

/** Wheel segments in display order, with the odds of landing on each (weights sum to 100). */
export const WHEEL = [
  { prize: 1, weight: 40 },
  { prize: 10, weight: 35 },
  { prize: 20, weight: 18 },
  { prize: 30, weight: 7 },
] as const;


/** Quote wheel: one spin in QUOTE_WHEEL_ODDS lands on tokens (the rest land on a speaker quote), up to QUOTE_WHEEL_DAILY_MAX tokens a day per account. */
export const QUOTE_WHEEL_ODDS = 5;
export const QUOTE_WHEEL_PRIZE = 10;
export const QUOTE_WHEEL_DAILY_MAX = 40;
