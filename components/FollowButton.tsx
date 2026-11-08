import Link from "next/link";
import { toggleFollow } from "@/app/actions/tokens";

/** Follow / Following toggle shown next to a speaker or host name. Works without JavaScript. */
export function FollowButton({ kind, name, following, signedIn, back, labels, size = "sm" }: {
  kind: "speaker" | "host"; name: string; following: boolean; signedIn: boolean; back: string;
  labels: { follow: string; following: string; unfollow: string }; size?: "sm" | "md";
}) {
  const cls = `${size === "md" ? "px-4 py-1.5 text-[12px]" : "px-2.5 py-0.5 text-[10px]"} inline-flex items-center gap-1 border-2 font-mono font-bold uppercase tracking-widest transition`;
  if (!signedIn)
    return <Link href={`/signin?next=${encodeURIComponent(back)}`} className={`${cls} border-ink hover:bg-ink hover:text-white`}>+ {labels.follow}</Link>;
  return (
    <form action={toggleFollow} className="inline">
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="name" value={name} /><input type="hidden" name="back" value={back} />
      {following ? (
        <button title={labels.unfollow} className={`${cls} group border-ink bg-ink text-white hover:border-accent hover:bg-accent`}>
          <span className="group-hover:hidden">✓ {labels.following}</span><span className="hidden group-hover:inline">{labels.unfollow}</span>
        </button>
      ) : (
        <button className={`${cls} border-ink hover:bg-ink hover:text-white`}>+ {labels.follow}</button>
      )}
    </form>
  );
}
