"use client";
import { useActionState, useState } from "react";
import { emailAuth, phoneAuth } from "@/app/actions/auth";

export function SignInForms({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [emailState, emailAction, emailPending] = useActionState(emailAuth, null);
  const [phoneState, phoneAction, phonePending] = useActionState(phoneAuth, null);

  return (
    <div className="space-y-6">
      <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        aria-disabled={!googleEnabled}
        className={`flex w-full items-center justify-center gap-3 border-2 border-ink py-3 font-sans font-semibold transition hover:bg-ink hover:text-white ${googleEnabled ? "" : "pointer-events-none opacity-40"}`}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </a>
      {!googleEnabled && <p className="-mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-ink/40">Google sign-in not configured yet</p>}

      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-ink/40"><span className="h-px flex-1 bg-ink/20" />or<span className="h-px flex-1 bg-ink/20" /></div>

      <div className="grid grid-cols-2 border-b-2 border-ink">
        {(["email", "phone"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`py-2 font-mono text-xs uppercase tracking-widest ${tab === t ? "bg-ink text-white" : "hover:bg-ink/5"}`}>
            {t === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>

      {tab === "email" ? (
        <form action={emailAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input name="email" type="email" required autoComplete="email" placeholder="Email" className="input" autoFocus />
          <input name="password" type="password" required minLength={8} autoComplete="current-password" placeholder="Password (8+ characters)" className="input" />
          <label className="flex items-center gap-2 text-sm text-ink/70"><input type="checkbox" name="newsletter" defaultChecked /> Send me the free weekly newsletter</label>
          {emailState?.error && <p className="text-sm text-accent">{emailState.error}</p>}
          <button disabled={emailPending} className="btn-dark w-full">{emailPending ? "…" : "Continue"}</button>
          <p className="text-center text-xs text-ink/50">New here? We'll create your account automatically.</p>
        </form>
      ) : (
        <form action={phoneAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          {phoneState?.step === "code" ? (
            <>
              <input type="hidden" name="phone" value={phoneState.phone} />
              <p className="text-sm">Enter the 6-digit code sent to <strong>{phoneState.phone}</strong></p>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="123456" className="input text-center font-mono text-2xl tracking-[0.5em]" />
              {phoneState.devHint && <p className="font-mono text-[11px] text-terminal-amber">{phoneState.devHint}</p>}
            </>
          ) : (
            <input name="phone" type="tel" required autoComplete="tel" placeholder="+1 555 123 4567" className="input" autoFocus />
          )}
          {phoneState?.error && <p className="text-sm text-accent">{phoneState.error}</p>}
          <button disabled={phonePending} className="btn-dark w-full">{phonePending ? "…" : phoneState?.step === "code" ? "Verify & sign in" : "Text me a code"}</button>
        </form>
      )}
    </div>
  );
}
