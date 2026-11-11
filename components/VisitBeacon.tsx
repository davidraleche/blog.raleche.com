"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/track-client";

/** The ?source= tag of the page the reader arrived on, until its page view is recorded. */
let carried: { path: string; source?: string; by?: string } | null = null;

/** Records each page view, and how long the page was actually visible when the reader leaves it. */
export function VisitBeacon() {
  const pathname = usePathname();
  // Every click on a link or button (what the visitor does next), and leaving the site (tab closed, reload or another site).
  useEffect(() => {
    let internalAt = 0; // a click that moves within the site (link or reload button) isn't leaving it
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as Element | null)?.closest?.("a, button, [role=button], label");
      if (!el || el.closest("[data-no-track], input[type=password]")) return;
      const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140);
      const href = el instanceof HTMLAnchorElement ? el.getAttribute("href") : null;
      const out = href && /^https?:/.test(href) && !href.includes(location.host) ? " (leaves the site)" : "";
      if (!out) internalAt = Date.now();
      trackEvent("click", href ? `${text || "link"} → ${href}${out}` : text || el.tagName.toLowerCase());
    };
    const onLeave = () => { if (Date.now() - internalAt > 3000) trackEvent("leave", `Closed the tab, went to another site or reloaded, on ${location.pathname}`); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onLeave);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("pagehide", onLeave); };
  }, []);
  useEffect(() => {
    let id: string | null = null;
    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? Date.now() : 0;
    let sent = false;

    // Links we share carry ?source=twitter, linkedin… (or utm_source): send it, then drop it from the address bar
    // so a reader who copies the link doesn't pass our tag on.
    const qs = new URLSearchParams(location.search);
    const tagged = qs.get("source") || qs.get("utm_source") || undefined;
    const by = qs.get("by") || undefined; // who shared the link
    if (tagged || by) carried = { path: location.pathname, source: tagged, by };
    // Kept outside the effect: in development React runs it twice, and the tag is already gone from the URL the second time.
    const mine = carried?.path === location.pathname ? carried : null;
    const source = mine?.source, sharedBy = mine?.by;
    if (tagged || by) {
      ["source", "by", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => qs.delete(k));
      const rest = qs.toString();
      try { window.history.replaceState(window.history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`); } catch {}
    }
    const t = setTimeout(() => {
      fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname, title: document.title, referrer: document.referrer, source, by: sharedBy }), keepalive: true })
        .then((r) => r.json())
        .then((j: { id?: string | null }) => { id = j.id ?? null; if (mine) carried = null; })
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
