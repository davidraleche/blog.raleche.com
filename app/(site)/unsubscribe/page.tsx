import { db } from "@/lib/db";

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const sub = key ? await db.subscriber.findUnique({ where: { unsubscribeKey: key } }) : null;
  if (sub) await db.subscriber.update({ where: { id: sub.id }, data: { status: "unsubscribed" } });
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="hed text-6xl">{sub ? "You're unsubscribed" : "Link not valid"}</h1>
      <p className="mt-4 font-serif text-xl text-ink/70">{sub ? `${sub.email} won't receive the newsletter anymore.` : "This unsubscribe link is invalid or expired."}</p>
    </div>
  );
}
