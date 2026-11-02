import { redirect } from "next/navigation";
import { getUser, safeNext } from "@/lib/auth";
import { SignInForms } from "./SignInForms";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured yet. Use email or phone.",
  google_state: "Google sign-in expired. Please try again.",
  google_token: "Google sign-in failed. Please try again.",
  google_profile: "Google didn't share an email address.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const dest = safeNext(next);
  if (await getUser()) redirect(dest);
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-14 md:grid-cols-2">
      <div>
        <p className="kicker">Welcome</p>
        <h1 className="hed mt-3 text-6xl">Sign in or create an account</h1>
        <p className="mt-4 font-serif text-xl text-ink/70">One step. No forms to fill. Use Google, your email, or your phone number.</p>
      </div>
      <div>
        {error && ERRORS[error] && <p className="mb-4 border-l-4 border-accent bg-accent/5 px-4 py-3 text-sm">{ERRORS[error]}</p>}
        <SignInForms next={dest} googleEnabled={!!process.env.GOOGLE_CLIENT_ID} />
      </div>
    </div>
  );
}
