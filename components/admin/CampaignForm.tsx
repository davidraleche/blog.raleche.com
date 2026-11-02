"use client";
import { useState } from "react";
import { marked } from "marked";
import type { Campaign } from "@prisma/client";
import { saveCampaign } from "@/app/admin/actions";

export function CampaignForm({ campaign }: { campaign?: Campaign | null }) {
  const [body, setBody] = useState(campaign?.body ?? "");
  const locked = campaign?.status === "sent";
  return (
    <form action={saveCampaign} className="space-y-3">
      <input type="hidden" name="id" value={campaign?.id ?? ""} />
      <input name="subject" required disabled={locked} defaultValue={campaign?.subject} placeholder="Subject line" className="term-input text-lg" />
      <div className="term-panel grid lg:grid-cols-2">
        <textarea name="body" disabled={locked} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write in Markdown…" className="min-h-[440px] bg-transparent p-4 font-mono text-sm text-slate-100 outline-none" />
        <div className="border-t border-terminal-line bg-white p-6 font-serif text-black lg:border-l lg:border-t-0">
          <div className="mb-4 bg-black px-4 py-2 font-display text-2xl font-extrabold tracking-widest text-white">RALECHE</div>
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(body || "*Preview*", { async: false }) as string }} />
        </div>
      </div>
      {!locked && <button className="term-btn">Save draft</button>}
    </form>
  );
}
