// Browser side: report a step to /api/track/event without slowing the page (survives navigation).
export function trackEvent(kind: "click" | "spin_quote" | "leave", detail: string, path = typeof location !== "undefined" ? location.pathname : "") {
  try {
    const payload = JSON.stringify({ kind, detail: detail.slice(0, 300), path });
    if (!navigator.sendBeacon?.("/api/track/event", new Blob([payload], { type: "application/json" })))
      fetch("/api/track/event", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  } catch {}
}
