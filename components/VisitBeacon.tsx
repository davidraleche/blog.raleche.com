"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Records each page view, and how long the page was actually visible when the reader leaves it. */
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    let id: string | null = null;
    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? Date.now() : 0;
    let sent = false;

    const t = setTimeout(() => {
      fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname, title: document.title, referrer: document.referrer }), keepalive: true })
        .then((r) => r.json())
        .then((j: { id?: string | null }) => { id = j.id ?? null; })
        .catch(() => {});
    }, 600);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (since) visibleMs += Date.now() - since;
        since = 0;
        report(); // tab hidden or closed: send what we have
      } else since = Date.now();
    };
    function report() {
      if (!id || sent) return;
      const seconds = (visibleMs + (since ? Date.now() - since : 0)) / 1000;
      if (seconds < 1) return;
      const payload = JSON.stringify({ id, seconds });
      if (!navigator.sendBeacon?.("/api/track/leave", new Blob([payload], { type: "application/json" })))
        fetch("/api/track/leave", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      if (document.visibilityState === "hidden") return; // may come back; a later report overwrites this one
      sent = true;
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", report);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", report);
      report(); // moved to another page inside the site
    };
  }, [pathname]);
  return null;
}
