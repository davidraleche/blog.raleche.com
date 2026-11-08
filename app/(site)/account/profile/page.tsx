import { requireUser } from "@/lib/auth";
import { ProfileForms } from "./ProfileForms";
import { getLocale } from "@/lib/i18n/server";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser("/account/profile");
  const locale = await getLocale();
  return <ProfileForms name={user.name ?? ""} email={user.email} phone={user.phone} hasPassword={!!user.passwordHash} language={user.language ?? locale} />;
}
