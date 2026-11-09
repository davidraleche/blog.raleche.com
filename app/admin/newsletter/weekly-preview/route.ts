import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { loadWeeklyContent, weeklyNewsletter } from "@/lib/weekly-newsletter";

/** The weekly briefing as subscribers will see it (English), built from the stories live right now. */
export async function GET() {
  await requireAdmin();
  const { html } = weeklyNewsletter(await loadWeeklyContent(db));
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Weekly briefing preview</title><body style="margin:0">${html}</body>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
