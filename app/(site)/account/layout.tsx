import { AccountNav } from "@/components/AccountNav";

export const metadata = { robots: { index: false, follow: false } };
import { getI18n } from "@/lib/i18n/server";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="hed text-6xl">{t("yourAccount")}</h1>
      <AccountNav />
      <div className="mt-10">{children}</div>
    </div>
  );
}
