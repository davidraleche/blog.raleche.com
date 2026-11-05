import type { Metadata } from "next";
import { Barlow_Condensed, Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { BCP47 } from "@/lib/i18n/messages";
import { I18nProvider } from "@/components/I18nProvider";
import { adsConfig } from "@/lib/ads";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "RALECHE — Technology, AI & Leadership", template: "%s | RALECHE" },
  description: "Technology, AI and the people building what's next. Executive summaries for members.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, ads] = await Promise.all([getLocale(), adsConfig()]);
  return (
    <html lang={BCP47[locale]} className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {ads && (
          <>
            {/* AdSense: plain tag in <head> on every page so Google's site verification finds it. */}
            <meta name="google-adsense-account" content={ads.client} />
            {/* Members and admins get the tag too, but with ad requests paused so no ads load. */}
            {ads.adFree && <script dangerouslySetInnerHTML={{ __html: "(window.adsbygoogle=window.adsbygoogle||[]).pauseAdRequests=1;" }} />}
            <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`} crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
