"use client";
import { useActionState } from "react";
import { saveName, changeEmail, changePassword, saveLanguage, type FormState } from "@/app/actions/account";
import { LOCALES, LOCALE_NAME } from "@/lib/i18n/messages";
import { useT } from "@/components/I18nProvider";

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

export function ProfileForms({ name, email, phone, hasPassword, language }: { name: string; email: string | null; phone: string | null; hasPassword: boolean; language: string }) {
  const t = useT();
  const [nameState, nameAction, namePending] = useActionState(saveName, null);
  const [emailState, emailAction, emailPending] = useActionState(changeEmail, null);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, null);
  const [langState, langAction, langPending] = useActionState(saveLanguage, null);
  const codeStep = emailState?.step === "code";

  return (
    <div className="grid gap-6">
      <Card title={t("name")}>
        <form action={nameAction} className="flex flex-col gap-3 sm:flex-row">
          <input name="name" defaultValue={name} placeholder={t("yourName")} className="input" required maxLength={80} />
          <button disabled={namePending} className="btn-dark shrink-0">{namePending ? t("saving") : t("save")}</button>
        </form>
        <Status state={nameState} />
      </Card>

      <Card title={t("preferredLanguage")}>
        <form action={langAction} className="flex flex-col gap-3 sm:flex-row">
          <select name="language" defaultValue={language} className="input">
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAME[l]}</option>)}
          </select>
          <button disabled={langPending} className="btn-dark shrink-0">{langPending ? t("saving") : t("save")}</button>
        </form>
        <p className="mt-3 text-xs text-ink/50">{t("preferredLanguageHelp")}</p>
        <Status state={langState} />
      </Card>

      <Card title={t("email")}>
        <p className="mb-4 text-sm text-ink/60">{t("current")} <span className="text-ink">{email ?? t("none")}</span></p>
        <form action={emailAction} className="grid gap-3">
          <input name="email" type="email" placeholder={t("newEmail")} className="input" required defaultValue={codeStep ? emailState?.email : ""} readOnly={codeStep} />
          {codeStep && (
            <>
              <p className="text-sm">{t("codeSentEmail", { email: emailState?.email ?? "" })}</p>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder={t("sixDigitCode")} className="input" required />
            </>
          )}
          <button disabled={emailPending} className="btn-dark justify-self-start">{emailPending ? t("working") : codeStep ? t("confirmNewEmail") : t("sendCode")}</button>
        </form>
        <Status state={emailState} />
      </Card>

      <Card title={t("password")}>
        <form action={pwAction} className="grid gap-3">
          {hasPassword && <input name="current" type="password" autoComplete="current-password" placeholder={t("currentPassword")} className="input" required />}
          <input name="password" type="password" autoComplete="new-password" placeholder={t("newPassword")} className="input" required minLength={8} />
          <button disabled={pwPending} className="btn-dark justify-self-start">{pwPending ? t("saving") : hasPassword ? t("changePassword") : t("setPassword")}</button>
        </form>
        <p className="mt-3 text-xs text-ink/50">{t("passwordNote")}</p>
        <Status state={pwState} />
      </Card>

      <Card title={t("phone")}>
        <p className="text-sm">{phone ? <>{t("signInPhone")} <span className="font-mono">{phone}</span></> : t("noPhone")}</p>
        <p className="mt-2 text-xs text-ink/50">{t("phoneNote")}</p>
      </Card>
    </div>
  );
}
