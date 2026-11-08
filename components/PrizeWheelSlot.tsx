import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { today } from "@/lib/utils";
import { PrizeWheel, type WheelLabels } from "./PrizeWheel";

/** Works out whether this visitor can spin today, or has a signed-out prize waiting to be collected. */
export async function PrizeWheelSlot() {
  const [user, jar, { t }] = await Promise.all([getUser(), cookies(), getI18n()]);
  const day = today();
  const pendingId = jar.get("wheel_spin")?.value;
  const pending = pendingId ? await db.wheelSpin.findUnique({ where: { id: pendingId } }) : null;
  const pendingOpen = !!pending && !pending.userId && !pending.claimedAt;

  let canSpin: boolean;
  if (user) canSpin = !(await db.wheelSpin.findUnique({ where: { userId_day: { userId: user.id, day } }, select: { id: true } }));
  else canSpin = !(pendingOpen && pending!.day === day);

  const keys = ["wheelTitle", "wheelDek", "spin", "youWon", "youWonOne", "addedToBalance", "signInToCollect", "collectPrize", "prizeCollected", "comeBackTomorrow", "alreadySpun", "dailySpin", "close", "soundOn", "soundOff", "tokensLabel"] as const;
  // Keep {n} placeholders for the browser to fill in.
  const labels = Object.fromEntries(keys.map((k) => [k, t(k, { n: "{n}" })])) as WheelLabels;

  return <PrizeWheel signedIn={!!user} canSpin={canSpin && !(user && pendingOpen)} claimPending={!!user && pendingOpen} labels={labels} />;
}
