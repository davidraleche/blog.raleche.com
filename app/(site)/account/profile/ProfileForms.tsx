"use client";
import { useActionState } from "react";
import { saveName, changeEmail, changePassword, type FormState } from "@/app/actions/account";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p className="mt-3 border-l-4 border-accent bg-accent/5 px-3 py-2 text-sm">{state.error}</p>;
  if (state?.ok) return <p className="mt-3 border-l-4 border-terminal-up bg-terminal-up/5 px-3 py-2 text-sm">{state.ok}</p>;
  return null;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-[3px] border-ink p-6">
      <p className="kicker">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileForms({ name, email, phone, hasPassword }: { name: string; email: string | null; phone: string | null; hasPassword: boolean }) {
  const [nameState, nameAction, namePending] = useActionState(saveName, null);
  const [emailState, emailAction, emailPending] = useActionState(changeEmail, null);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, null);
  const codeStep = emailState?.step === "code";

  return (
    <div className="grid gap-6">
      <Card title="Name">
        <form action={nameAction} className="flex flex-col gap-3 sm:flex-row">
          <input name="name" defaultValue={name} placeholder="Your name" className="input" required maxLength={80} />
          <button disabled={namePending} className="btn-dark shrink-0">{namePending ? "Saving…" : "Save"}</button>
        </form>
        <Status state={nameState} />
      </Card>

      <Card title="Email">
        <p className="mb-4 text-sm text-ink/60">Current: <span className="text-ink">{email ?? "none"}</span></p>
        <form action={emailAction} className="grid gap-3">
          <input name="email" type="email" placeholder="New email address" className="input" required defaultValue={codeStep ? emailState?.email : ""} readOnly={codeStep} />
          {codeStep && (
            <>
              <p className="text-sm">We sent a 6-digit code to <b>{emailState?.email}</b>. Enter it to confirm.</p>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="input" required />
            </>
          )}
          <button disabled={emailPending} className="btn-dark justify-self-start">{emailPending ? "Working…" : codeStep ? "Confirm new email" : "Send confirmation code"}</button>
        </form>
        <Status state={emailState} />
      </Card>

      <Card title="Password">
        <form action={pwAction} className="grid gap-3">
          {hasPassword && <input name="current" type="password" autoComplete="current-password" placeholder="Current password" className="input" required />}
          <input name="password" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" className="input" required minLength={8} />
          <button disabled={pwPending} className="btn-dark justify-self-start">{pwPending ? "Saving…" : hasPassword ? "Change password" : "Set a password"}</button>
        </form>
        <p className="mt-3 text-xs text-ink/50">Changing your password signs you out on other devices.</p>
        <Status state={pwState} />
      </Card>

      <Card title="Phone">
        <p className="text-sm">{phone ? <>Sign-in phone: <span className="font-mono">{phone}</span></> : "No phone linked."}</p>
        <p className="mt-2 text-xs text-ink/50">The phone number is used for sign-in codes. To change it, contact us.</p>
      </Card>
    </div>
  );
}
