import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET() {
  const user = await getUser();
  if (user?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const subs = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  const csv = ["email,status,source,created_at", ...subs.map((s) => `${s.email},${s.status},${s.source},${s.createdAt.toISOString()}`)].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
