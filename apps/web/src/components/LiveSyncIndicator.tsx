'use client';

import { useEffect, useState } from 'react';

export interface LiveSyncIndicatorProps {
  /** Epoch ms of the last successful background refresh, or null before the first one lands. */
  lastSyncedAt: number | null;
}

/**
 * Live "this view stays fresh" signal (see ADR-0020) — ticks client-side
 * only, same reasoning as CountdownTimer's SSR/CSR-mismatch guard. Purely
 * presentational: the actual freshness comes from CommandCenterPage's
 * background polling, this just shows how recent it was.
 */
export function LiveSyncIndicator({ lastSyncedAt }: LiveSyncIndicatorProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (now === null || lastSyncedAt === null) {
    return null;
  }

  const secondsAgo = Math.max(0, Math.round((now - lastSyncedAt) / 1000));
  const label = secondsAgo < 2 ? 'Synced just now' : `Synced ${secondsAgo}s ago`;

  return (
    <span className="text-kicker inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
      {label}
    </span>
  );
}
