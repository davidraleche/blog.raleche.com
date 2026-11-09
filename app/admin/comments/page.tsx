import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { moderateComment, setCommentBan } from "../actions";
import { fmtDate } from "@/lib/utils";

export default async function Comments() {
  const comments = await db.comment.findMany({
    include: { user: { select: { id: true, email: true, phone: true, name: true, commentBanned: true, googleId: true } }, post: { select: { title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  // Waiting for review first, then everything else newest first.
  const pending = comments.filter((c) => c.hidden && c.heldReason && !["hidden by admin", "commenter banned"].includes(c.heldReason));
  const rest = comments.filter((c) => !pending.includes(c));
  const rows = [...pending, ...rest];

  return (
    <div>
      <PageTitle title="Comments" sub={`${pending.length} waiting for review · ${comments.length} latest`} />
      <p className="mb-4 text-[11px] text-terminal-dim">
        Protection: sign-in required, honeypot and timing traps for bots, no links/emails/phones, rate limits (2/min, 10/hour, 30/day, 3 per story per hour), duplicate text refused,
        review for first comments from new or unverified accounts, copied text and spammy wording, 3 reader reports hide a comment. Tokens are paid when a comment goes public.
      </p>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Date</th><th>Member</th><th>Story</th><th>Comment</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-terminal-dim">No comments yet.</td></tr>}
            {rows.map((c) => {
              const isPending = pending.includes(c);
              return (
                <tr key={c.id}>
                  <td className="whitespace-nowrap text-terminal-dim">{fmtDate(c.createdAt)}</td>
                  <td>
                    <div className="text-slate-100">{c.user.email ?? c.user.phone ?? c.user.name}</div>
                    <div className="space-x-1">{c.user.googleId && <Badge>Google</Badge>}{c.user.phone && <Badge>Phone</Badge>}{c.user.commentBanned && <Badge tone="down">Banned</Badge>}</div>
                  </td>
                  <td><Link href={`/story/${c.post.slug}#comments`} className="hover:text-terminal-amber">{c.post.title.slice(0, 50)}</Link></td>
                  <td className="max-w-md whitespace-pre-line break-words">{c.body}</td>
                  <td>
                    <Badge tone={isPending ? "amber" : c.hidden ? "down" : "up"}>{isPending ? "Review" : c.hidden ? "Hidden" : "Visible"}</Badge>
                    {c.heldReason && <div className="mt-1 text-[10px] text-terminal-dim">{c.heldReason}</div>}
                    {c.reports > 0 && <div className="mt-1 text-[10px] text-terminal-down">{c.reports} report{c.reports > 1 ? "s" : ""}</div>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    {c.hidden ? (
                      <form action={moderateComment} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="show" /><button className="text-terminal-up hover:underline">Approve</button></form>
                    ) : (
                      <form action={moderateComment} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="hide" /><button className="text-terminal-amber hover:underline">Hide</button></form>
                    )}
                    <form action={moderateComment} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="delete" /><button className="text-terminal-down hover:underline">Delete</button></form>
                    <form action={setCommentBan} className="inline"><input type="hidden" name="userId" value={c.user.id} /><input type="hidden" name="banned" value={c.user.commentBanned ? "0" : "1"} /><button className="text-terminal-dim hover:text-terminal-down hover:underline">{c.user.commentBanned ? "Unban" : "Ban"}</button></form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
