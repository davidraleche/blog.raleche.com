import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitBeacon } from "@/components/VisitBeacon";
import { QuoteWheelSlot } from "@/components/QuoteWheelSlot";

export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <VisitBeacon />
      <QuoteWheelSlot />
    </>
  );
}
