import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle, Badge } from "@/components/admin/ui";
import { saveQuiz, regenerateQuiz } from "../actions";
import { isValidQuiz } from "@/lib/quiz";

export default async function Quizzes({ searchParams }: { searchParams: Promise<{ post?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const [posts, attempts] = await Promise.all([
    db.post.findMany({ where: { status: "published" }, select: { id: true, slug: true, title: true, quiz: true }, orderBy: { publishedAt: "desc" } }),
    db.quizAttempt.groupBy({ by: ["postId"], _count: true, _sum: { earned: true } }),
  ]);
  const stats = new Map(attempts.map((a) => [a.postId, a]));
  return (
    <div>
      <PageTitle title="Quizzes" sub="2 questions per article · both right = 10 tokens · one try per reader" />
      {sp.error && <p className="term-panel mb-4 border-terminal-down p-3 text-terminal-down">Not saved: {sp.error === "json" ? "that isn't valid JSON." : sp.error === "shape" ? "it needs exactly 2 questions, each with 4 options and an answer from 0 to 3." : sp.error}</p>}
      <div className="space-y-4">
        {posts.map((p) => {
          const q = p.quiz && isValidQuiz(p.quiz.questions) ? p.quiz.questions : null;
          const s = stats.get(p.id);
          return (
            <details key={p.id} open={sp.post === p.id} className="term-panel p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="text-slate-100">{p.title}</span>
                {q ? <Badge tone="up">{p.quiz!.source}</Badge> : <Badge tone="down">No quiz</Badge>}
                {sp.saved === p.id && <Badge tone="amber">Saved</Badge>}
                <span className="text-terminal-dim">{s ? `${s._count} plays · ${s._sum.earned ?? 0} tokens paid` : "no plays yet"}</span>
              </summary>
              {q && (
                <ol className="mt-3 space-y-2 text-[12px]">
                  {q.map((x, i) => (
                    <li key={i}><span className="text-slate-100">{i + 1}. {x.q}</span> <span className="text-terminal-dim">→ {x.options.map((o, j) => (j === x.answer ? <b key={j} className="text-terminal-up">[{o}] </b> : <span key={j}>{o} · </span>))}</span></li>
                  ))}
                </ol>
              )}
              <form action={saveQuiz} className="mt-3">
                <input type="hidden" name="postId" value={p.id} />
                <textarea name="json" rows={8} className="term-input w-full font-mono text-[11px]" defaultValue={JSON.stringify(q ?? [{ q: "", options: ["", "", "", ""], answer: 0 }, { q: "", options: ["", "", "", ""], answer: 0 }], null, 2)} />
                <div className="mt-2 flex gap-4">
                  <button className="text-terminal-up hover:underline">Save quiz</button>
                  <button formAction={regenerateQuiz} className="text-terminal-amber hover:underline">Generate with AI</button>
                  <Link href={`/story/${p.slug}#quiz`} className="text-terminal-dim hover:underline">View on site</Link>
                </div>
              </form>
            </details>
          );
        })}
      </div>
    </div>
  );
}
