import { AccountNav } from "@/components/AccountNav";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="hed text-6xl">Your account</h1>
      <AccountNav />
      <div className="mt-10">{children}</div>
    </div>
  );
}
