import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { setUserRole, deleteUser, setMemberList, adjustTokens, setMemberLanguage } from "../actions";
import { LOCALES, LOCALE_LABEL } from "@/lib/i18n/messages";
import { EMAIL_LISTS } from "@/lib/lists";
import { fmtDate } from "@/lib/utils";
import { getUser } from "@/lib/auth";

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [users, me, subscribers] = await Promise.all([
    db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    getUser(),
    db.subscriber.findMany({ select: { email: true, status: true } }),
  ]);
  const newsletter = new Map(subscribers.map((s) => [s.email, s.status === "subscribed"]));
  return (
    <div>
      <PageTitle title="Members" sub={`${users.length} accounts`} />
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={q} placeholder="Search email, phone, name…" className="term-input max-w-sm" /><button className="term-btn-ghost">Search</button></form>
      <div className="term-panel overflow-x-auto">
        <table className="term-table">
          <thead><tr><th>Account</th><th>Login</th><th>Tokens</th><th>Language</th><th>Email lists</th><th>Role</th><th>Joined</th><th>Last seen</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td><div className="text-slate-100">{u.email || u.phone}</div><div className="text-[10px] text-terminal-dim">{u.name}</div></td>
                  <td className="space-x-1">{u.googleId && <Badge>Google</Badge>}{u.passwordHash && <Badge>Pwd</Badge>}{u.phone && <Badge>Phone</Badge>}</td>
                  <td>
                    <div className="font-semibold text-terminal-amber">{u.tokenBalance.toLocaleString()}</div>
                    <form action={adjustTokens} className="mt-1 flex gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="amount" placeholder="±" className="term-input w-14 py-1 text-[11px]" title="Tokens to add (negative to remove)" />
                      <button className="text-terminal-up hover:underline">Apply</button>
                    </form>
                  </td>
                  <td>
                    <form action={setMemberLanguage} className="flex gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="language" defaultValue={u.language ?? "en"} className="term-input w-16 py-1 text-[11px]">{LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}</select>
                      <button className="text-terminal-up hover:underline">Set</button>
                    </form>
                  </td>
                  <td>
                    {!u.email ? <span className="text-terminal-dim">No email</span> : (
                      <div className="space-y-1">
                        {EMAIL_LISTS.map((l) => {
                          const on = l.id === "newsletter" && newsletter.get(u.email!) === true;
                          return (
                            <form key={l.id} action={setMemberList} className="flex items-center gap-2 whitespace-nowrap">
                              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="list" value={l.id} /><input type="hidden" name="on" value={on ? "0" : "1"} />
                              <Badge tone={on ? "up" : "dim"}>{l.name}</Badge>
                              <button className={on ? "text-terminal-down hover:underline" : "text-terminal-up hover:underline"}>{on ? "Unsubscribe" : "Subscribe"}</button>
                            </form>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td><Badge tone={u.role === "ADMIN" ? "amber" : "dim"}>{u.role}</Badge></td>
                  <td className="whitespace-nowrap text-terminal-dim">{fmtDate(u.createdAt)}</td>
                  <td className="whitespace-nowrap text-terminal-dim">{fmtDate(u.lastSeenAt)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
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
