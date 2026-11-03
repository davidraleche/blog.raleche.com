"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: pathname, title: document.title, referrer: document.referrer }), keepalive: true }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
