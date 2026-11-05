import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { getUser, safeNext } from "@/lib/auth";
import { SignInForms } from "./SignInForms";

export const metadata = { title: "Sign in", robots: { index: false, follow: true }, alternates: { canonical: "/signin" } };

const ERRORS: Record<string, keyof Messages> = {
  google_not_configured: "googleNotConfigured",
  google_state: "googleState",
  google_token: "googleToken",
  google_profile: "googleProfile",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const dest = safeNext(next);
  if (await getUser()) redirect(dest);
  const { t } = await getI18n();
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-14 md:grid-cols-2">
      <div>
        <p className="kicker">{t("welcome")}</p>
        <h1 className="hed mt-3 text-6xl">{t("signInTitle")}</h1>
        <p className="mt-4 font-serif text-xl text-ink/70">{t("signInText")}</p>
      </div>
      <div>
        {error && ERRORS[error] && <p className="mb-4 border-l-4 border-accent bg-accent/5 px-4 py-3 text-sm">{t(ERRORS[error])}</p>}
        <SignInForms next={dest} googleEnabled={!!process.env.GOOGLE_CLIENT_ID} />
      </div>
    </div>
  );
}
