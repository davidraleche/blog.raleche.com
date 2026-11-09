"use client";
import { useEffect, useRef } from "react";
import { buyTokens } from "@/app/actions/tokens";

type Pack = { id: string; tokens: number; price: string };

/**
 * "Not enough tokens" popup. The reader buys a pack without leaving the page: Stripe Checkout sends them
 * straight back here and the thing they wanted (`then`) is unlocked automatically.
 */
export function TopUpDialog({ packs, balance, cost, next, then, labels }: {
  packs: Pack[]; balance: number; cost: number; next: string; then: string; labels: Record<string, string>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const short = Math.max(0, cost - balance);
  const best = packs.find((p) => p.tokens >= short)?.id ?? packs[packs.length - 1]?.id;
  const fill = (s: string) => s.replace("{b}", balance.toLocaleString()).replace("{n}", cost.toLocaleString()).replace("{s}", short.toLocaleString());

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function close() {
    ref.current?.close();
    const u = new URL(window.location.href);
    u.searchParams.delete("topup");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  }

  return (
    <dialog ref={ref} onCancel={close} onClick={(e) => { if (e.target === ref.current) close(); }} className="w-[min(94vw,560px)] border-[3px] border-ink bg-white p-0 shadow-[8px_8px_0_#0a0a0a] backdrop:bg-ink/60">
      <div className="flex items-center justify-between bg-ink px-5 py-3 text-white">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terminal-amber">{labels.topUpTitle}</span>
        <button type="button" onClick={close} aria-label={labels.close} className="font-mono text-lg leading-none hover:text-terminal-amber">×</button>
      </div>
      <div className="p-5">
        <p className="font-display text-3xl font-extrabold uppercase">{fill(labels.topUpNeed)}</p>
        <p className="mt-2 font-serif text-lg text-ink/70">{fill(labels.topUpDetail)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {packs.map((p) => {
            const isBest = p.id === best;
            return (
              <form key={p.id} action={buyTokens}>
                <input type="hidden" name="pack" value={p.id} />
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="then" value={then} />
                <button className={`relative flex w-full flex-col items-center border-[3px] border-ink px-3 pb-3 pt-5 transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#e1251b] ${isBest ? "bg-ink text-white" : "bg-white"}`}>
                  {isBest && <span className="absolute -top-3 bg-accent px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">{labels.topUpBest}</span>}
                  <span className="font-display text-4xl font-extrabold">{p.tokens.toLocaleString()}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest">{labels.tokensLabel}</span>
                  <span className={`mt-3 w-full py-1.5 font-mono text-sm font-bold ${isBest ? "bg-terminal-amber text-ink" : "bg-ink text-white"}`}>{p.price}</span>
                </button>
              </form>
            );
          })}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink/50">🔒 {labels.topUpSecure}</p>
      </div>
    </dialog>
  );
}
