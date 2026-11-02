import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { setUserRole, compMembership, deleteUser } from "../actions";
import { fmtDate } from "@/lib/utils";
import { getUser } from "@/lib/auth";

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [users, plans, me] = await Promise.all([
    db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    getUser(),
  ]);
  return (
    <div>
      <PageTitle title="Members" sub={`${users.length} accounts`} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Search email, phone, name…" className="term-input max-w-sm" /><button className="term-btn-ghost">Search</button></form>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Account</th><th>Login</th><th>Plan</th><th>Role</th><th>Joined</th><th>Last seen</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const sub = u.subscriptions.find((s) => ["active", "trialing", "past_due"].includes(s.status));
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td><div className="text-slate-100">{u.email || u.phone}</div><div className="text-[10px] text-terminal-dim">{u.name}</div></td>
                  <td className="space-x-1">{u.googleId && <Badge>Google</Badge>}{u.passwordHash && <Badge>Pwd</Badge>}{u.phone && <Badge>Phone</Badge>}</td>
                  <td>{sub ? <Badge tone="up">{sub.plan.name}{sub.priceCents === 0 ? " · comp" : ""}</Badge> : <span className="text-terminal-dim">Free</span>}</td>
                  <td><Badge tone={u.role === "ADMIN" ? "amber" : "dim"}>{u.role}</Badge></td>
                  <td className="whitespace-nowrap text-terminal-dim">{fmtDate(u.createdAt)}</td>
                  <td className="whitespace-nowrap text-terminal-dim">{fmtDate(u.lastSeenAt)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {!sub && (
                        <form action={compMembership} className="flex gap-1">
                          <input type="hidden" name="id" value={u.id} />
                          <select name="planId" className="term-input w-28 py-1 text-[11px]">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                          <input name="days" defaultValue={30} className="term-input w-14 py-1 text-[11px]" title="Days" />
                          <button className="text-terminal-up hover:underline">Comp</button>
                        </form>
                      )}
                      {!self && (
                        <>
                          <form action={setUserRole}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="role" value={u.role === "ADMIN" ? "USER" : "ADMIN"} />
                            <button className="text-terminal-amber hover:underline">{u.role === "ADMIN" ? "Revoke admin" : "Make admin"}</button></form>
                          <form action={deleteUser}><input type="hidden" name="id" value={u.id} /><button className="text-terminal-down hover:underline">Delete</button></form>
                        </>
                      )}
                    </div>
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
