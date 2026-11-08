import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { moderateComment } from "../actions";
import { fmtDate } from "@/lib/utils";

export default async function Comments() {
  const comments = await db.comment.findMany({
    include: { user: { select: { email: true, name: true } }, post: { select: { title: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageTitle title="Comments" sub={`${comments.length} latest`} />
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Date</th><th>Member</th><th>Story</th><th>Comment</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {comments.length === 0 && <tr><td colSpan={6} className="text-terminal-dim">No comments yet.</td></tr>}
            {comments.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap text-terminal-dim">{fmtDate(c.createdAt)}</td>
                <td className="text-slate-100">{c.user.email ?? c.user.name}</td>
                <td><Link href={`/story/${c.post.slug}#comments`} className="hover:text-terminal-amber">{c.post.title.slice(0, 50)}</Link></td>
                <td className="max-w-md whitespace-pre-line">{c.body}</td>
                <td><Badge tone={c.hidden ? "down" : "up"}>{c.hidden ? "Hidden" : "Visible"}</Badge></td>
                <td className="space-x-2 whitespace-nowrap">
                  <form action={moderateComment} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value={c.hidden ? "show" : "hide"} /><button className="text-terminal-amber hover:underline">{c.hidden ? "Show" : "Hide"}</button></form>
                  <form action={moderateComment} className="inline"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="delete" /><button className="text-terminal-down hover:underline">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
