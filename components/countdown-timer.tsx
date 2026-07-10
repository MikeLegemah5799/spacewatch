"use client";

import { useEffect, useState } from "react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function getRemaining(targetMs: number): Remaining {
  const diff = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.floor(diff / 1000);

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** Ticks client-side only — the initial render matches the server (all
 * zeros) and the real value is filled in after mount to avoid a hydration
 * mismatch against the server's render timestamp. */
export function CountdownTimer({ target }: { target: string }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const targetMs = new Date(target).getTime();
    // The first tick has to run post-mount (not in a lazy initializer) so
    // this render matches the server's SSR output; only then can we show
    // the real value and start ticking.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(getRemaining(targetMs));
    const id = setInterval(() => setRemaining(getRemaining(targetMs)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const { days, hours, minutes, seconds } = remaining ?? {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  return (
    <div className="flex flex-col items-end">
      <div className="font-display text-5xl font-bold tabular-nums text-neon-300 [text-shadow:var(--glow-text)]">
        {pad(days)}:{pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </div>
      <div className="mt-1 flex gap-6 font-mono text-[11px] tracking-widest text-ink-dim">
        <span>DD</span>
        <span>HH</span>
        <span>MM</span>
        <span>SS</span>
      </div>
    </div>
  );
}
