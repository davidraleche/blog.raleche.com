"use client";
import { useEffect, useState } from "react";

/** Hidden fields checked by lib/bot-guard.ts: a honeypot people never see, and "ready", set 2 s after the form appears. */
export function BotTrap() {
  const [ready, setReady] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setReady("1"), 2000);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <input type="hidden" name="ready" value={ready} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
