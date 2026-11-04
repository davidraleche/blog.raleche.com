import type { Metadata } from "next";
import { Barlow_Condensed, Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { BCP47 } from "@/lib/i18n/messages";
import { I18nProvider } from "@/components/I18nProvider";

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
  const locale = await getLocale();
  return (
    <html lang={BCP47[locale]} className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
