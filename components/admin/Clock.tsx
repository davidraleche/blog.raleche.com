"use client";
import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="tabular-nums">
      {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" }).toUpperCase()} {now.toLocaleTimeString("en-US", { hour12: false })} <span className="text-terminal-dim">ET</span>
    </span>
  );
}
