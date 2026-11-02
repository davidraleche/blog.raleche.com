"use client";
import { useState } from "react";
import { marked } from "marked";
import type { Post, Category } from "@prisma/client";
import { savePost } from "@/app/admin/actions";

const toLocal = (d: Date | null | undefined) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "");

export function PostEditor({ post, categories }: { post?: Post | null; categories: Category[] }) {
  const [body, setBody] = useState(post?.body ?? "");
  const [summary, setSummary] = useState(post?.executiveSummary ?? "");
  const [cover, setCover] = useState(post?.coverImage ?? "");
  const [tab, setTab] = useState<"body" | "summary">("body");
  const [preview, setPreview] = useState(true);
  const md = tab === "body" ? body : summary;

  return (
    <form action={savePost} className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="id" value={post?.id ?? ""} />
      <input type="hidden" name="body" value={body} />
      <input type="hidden" name="executiveSummary" value={summary} />
      <div className="min-w-0 space-y-3">
        <input name="title" required defaultValue={post?.title} placeholder="Headline" className="term-input text-lg" />
        <textarea name="dek" defaultValue={post?.dek} placeholder="Dek / subtitle shown under the headline" rows={2} className="term-input" />
        <div className="term-panel">
          <div className="flex items-center justify-between border-b border-terminal-line">
            <div className="flex">
              {(["body", "summary"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`px-4 py-2 font-mono text-[11px] uppercase tracking-widest ${tab === t ? "bg-terminal-amber/10 text-terminal-amber" : "text-slate-400 hover:text-white"}`}>
                  {t === "body" ? "Article body" : "Executive summary (members)"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 px-3 font-mono text-[10px] uppercase text-terminal-dim">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preview
            </label>
          </div>
          <div className={`grid ${preview ? "lg:grid-cols-2" : ""}`}>
            <textarea
              value={md}
              onChange={(e) => (tab === "body" ? setBody(e.target.value) : setSummary(e.target.value))}
              placeholder={tab === "body" ? "Write in Markdown…" : "## The short version\n- Key point one\n- Key point two"}
              className="min-h-[560px] w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-slate-100 outline-none"
            />
            {preview && (
              <div className="prose prose-invert prose-sm max-w-none overflow-y-auto border-t border-terminal-line bg-white/[0.02] p-4 lg:max-h-[560px] lg:border-l lg:border-t-0"
                dangerouslySetInnerHTML={{ __html: marked.parse(md || "*Nothing yet*", { async: false }) as string }} />
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="term-panel space-y-3 p-4">
          <p className="term-label text-terminal-amber">Publish</p>
          <select name="status" defaultValue={post?.status ?? "draft"} className="term-input">
            <option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option>
          </select>
          <label className="block"><span className="term-label">Publish date</span>
            <input type="datetime-local" name="publishedAt" defaultValue={toLocal(post?.publishedAt)} className="term-input mt-1" /></label>
          <label className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" name="featured" defaultChecked={post?.featured} /> Featured on homepage</label>
          <label className="flex items-center gap-2 font-mono text-xs"><input type="checkbox" name="premium" defaultChecked={post?.premium} /> Members-only article</label>
          <button className="term-btn w-full justify-center">Save</button>
        </div>
        <div className="term-panel space-y-3 p-4">
          <p className="term-label text-terminal-amber">Details</p>
          <label className="block"><span className="term-label">Slug</span><input name="slug" defaultValue={post?.slug} placeholder="auto from title" className="term-input mt-1" /></label>
          <label className="block"><span className="term-label">Section</span>
            <select name="categoryId" defaultValue={post?.categoryId ?? ""} className="term-input mt-1">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="block"><span className="term-label">Tags (comma separated)</span><input name="tags" defaultValue={post?.tags} className="term-input mt-1" /></label>
          <label className="block"><span className="term-label">Byline</span><input name="authorName" defaultValue={post?.authorName} className="term-input mt-1" /></label>
          <label className="block"><span className="term-label">Cover image URL</span><input name="coverImage" value={cover} onChange={(e) => setCover(e.target.value)} className="term-input mt-1" /></label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover} alt="" className="w-full border border-terminal-line" />}
        </div>
      </aside>
    </form>
  );
}
