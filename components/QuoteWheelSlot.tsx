import { getI18n } from "@/lib/i18n/server";
import { getSpeakerQuotes, quoteWheelLabels } from "@/lib/quotes";
import { QuoteWheelButton } from "./QuoteWheel";

/** The floating Daily spin button, which opens the quote wheel. */
export async function QuoteWheelSlot() {
  const { locale, t } = await getI18n();
  const quotes = await getSpeakerQuotes(locale);
  return <QuoteWheelButton quotes={quotes} labels={quoteWheelLabels(t)} buttonLabel={t("dailySpin")} />;
}
