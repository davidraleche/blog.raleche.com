import Script from "next/script";
import { adsConfig, type AdSlotName } from "@/lib/ads";
import { AdUnit } from "./AdUnit";
import { getI18n } from "@/lib/i18n/server";

/** Loads the AdSense script once per page (also enables Auto ads if turned on in AdSense). */
export async function AdsScript() {
  const ads = await adsConfig();
  if (!ads) return null;
  return <Script async strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`} />;
}

export async function AdSlot({ name, className = "" }: { name: AdSlotName; className?: string }) {
  const ads = await adsConfig();
  const slot = ads?.slots[name];
  if (!ads || !slot) return null;
  const { t } = await getI18n();
  return (
    <div className={`my-10 ${className}`}>
      <p className="mb-1 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-ink/40">{t("advertisement")}</p>
      <AdUnit client={ads.client} slot={slot} />
    </div>
  );
}
