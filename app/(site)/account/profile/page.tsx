import { requireUser } from "@/lib/auth";
import { ProfileForms } from "./ProfileForms";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser("/account/profile");
  return <ProfileForms name={user.name ?? ""} email={user.email} phone={user.phone} hasPassword={!!user.passwordHash} />;
}
