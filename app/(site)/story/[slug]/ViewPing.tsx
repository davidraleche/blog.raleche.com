"use client";
import { useEffect } from "react";

export function ViewPing({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `v:${postId}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
    fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
  }, [postId]);
  return null;
}
