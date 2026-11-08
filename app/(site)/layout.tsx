import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VisitBeacon } from "@/components/VisitBeacon";
import { PrizeWheelSlot } from "@/components/PrizeWheelSlot";

export const dynamic = "force-dynamic";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <VisitBeacon />
      <PrizeWheelSlot />
    </>
  );
}
