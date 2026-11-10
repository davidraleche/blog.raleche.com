import "server-only";
import { db } from "./db";
import { renderMarkdown } from "./markdown";
import { LOCALES, type Locale } from "./i18n/messages";
import { translateHtml, translateMany } from "./translate";
import { answersInSummary, generateQuiz, getQuiz, isValidQuiz, type QuizQuestion } from "./quiz";
import { extractMentions } from "./mentions-ai";
import { saveMentions } from "./books";

export type PrepareReport = { slug: string; quiz: "created" | "kept" | "fixed" | "missing"; answersInSummary: boolean | null; languages: Locale[]; books?: number; note?: string };

const OTHER = LOCALES.filter((l): l is Exclude<Locale, "en"> => l !== "en");

/**
 * Gets a published story ready for readers: the books and people mentioned in it are found (for the Books
 * section and its Amazon links), its quiz exists and every answer is stated in the executive summary, and the
 * summary, quiz and headline are translated (and cached) in every language.
 * With recheck, an existing AI or starter quiz is verified and rewritten if an answer is not in the summary (quizzes edited by an admin are never touched).
 */
export async function prepareStory(postId: string, opts: { recheck?: boolean } = {}): Promise<PrepareReport> {
  const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, slug: true, title: true, dek: true, body: true, executiveSummary: true, status: true, mentionsAt: true } });
  if (!post || post.status !== "published") return { slug: post?.slug ?? postId, quiz: "missing", answersInSummary: null, languages: [], note: "not published" };
  const summary = post.executiveSummary || post.body;
  const report: PrepareReport = { slug: post.slug, quiz: "missing", answersInSummary: null, languages: [] };

  // 0. Books and people (admin edits are kept: only stories never extracted are done here)
  if (!post.mentionsAt) {
    try {
      const m = await extractMentions(post.title, post.body);
      await saveMentions(post.id, m);
      report.books = m.books.length;
    } catch (e) {
      report.note = (e as Error).message.slice(0, 200);
      console.error(`[prepare] books for ${post.slug}: ${report.note}`);
    }
  }

  // 1. Quiz
  let quiz: QuizQuestion[] | null = await getQuiz(post.id);
  try {
    if (!quiz) {
      quiz = await generateQuiz(post.title, summary);
      await db.quiz.upsert({ where: { postId: post.id }, create: { postId: post.id, questions: quiz, source: "ai" }, update: {} });
      report.quiz = "created"; report.answersInSummary = true;
    } else if (opts.recheck && post.executiveSummary) {
      const ok = (await answersInSummary(summary, quiz)).every(Boolean);
      report.answersInSummary = ok;
      const row = await db.quiz.findUnique({ where: { postId: post.id }, select: { source: true } });
      if (!ok && (row?.source === "ai" || row?.source === "seed")) {
        quiz = await generateQuiz(post.title, summary);
        await db.quiz.update({ where: { postId: post.id }, data: { questions: quiz, source: "ai" } });
        report.quiz = "fixed"; report.answersInSummary = true;
      } else report.quiz = "kept";
    } else report.quiz = "kept";
  } catch (e) {
    report.note = (e as Error).message.slice(0, 200);
    console.error(`[prepare] quiz for ${post.slug}: ${report.note}`);
  }
  if (quiz && !isValidQuiz(quiz)) quiz = null;

  // 2. Translations: same strings the story page asks for, so readers get them straight from the cache.
  const summaryHtml = post.executiveSummary ? renderMarkdown(post.executiveSummary) : "";
  const quizTexts = quiz ? quiz.flatMap((q) => [q.q, ...q.options]) : [];
  for (const lang of OTHER) {
    try {
      const [html] = await Promise.all([summaryHtml ? translateHtml(lang, summaryHtml) : Promise.resolve(""), translateMany(lang, [post.title, post.dek, ...quizTexts].filter(Boolean))]);
      if (!summaryHtml || html !== summaryHtml) report.languages.push(lang);
    } catch (e) {
      console.error(`[prepare] ${lang} for ${post.slug}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  return report;
}

/** Prepares several stories one after another (kept sequential to stay inside API limits). */
export async function prepareStories(ids: string[], opts: { recheck?: boolean } = {}) {
  const reports: PrepareReport[] = [];
  for (const id of ids) reports.push(await prepareStory(id, opts).catch((e) => ({ slug: id, quiz: "missing" as const, answersInSummary: null, languages: [], note: (e as Error).message.slice(0, 200) })));
  console.log("[prepare]", JSON.stringify(reports));
  return reports;
}
