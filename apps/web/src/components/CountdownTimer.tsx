'use client';

import { AlarmClockOff, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classifyCountdown, formatDuration } from '../lib/sla-policy';
import { cn } from '../lib/utils';

export interface CountdownTimerProps {
  /** When the SLA clock started (e.g. `decision.createdAt`). */
  createdAt: string;
  /** Computed deadline — see `computeDecisionDeadline` (ADR-0014). */
  deadline: Date;
  className?: string;
}

const STATE_CLASSES: Record<string, string> = {
  calm: 'border-countdown-calm/40 bg-countdown-calm/10 text-countdown-calm',
  warning: 'border-countdown-warning/40 bg-countdown-warning/10 text-countdown-warning',
  danger: 'border-countdown-danger/50 bg-countdown-danger/10 text-countdown-danger animate-pulse-danger',
  overdue: 'border-countdown-overdue/60 bg-countdown-overdue/20 text-countdown-overdue animate-pulse-danger',
};

/**
 * Live, ticking SLA countdown (see ADR-0014). Purely presentational: reads
 * `createdAt`/`deadline` already derivable from real Decision/Incident
 * fields — no fabricated number, no backend call. Re-renders every second
 * client-side only (SSR would render a stale value the moment it's sent).
 */
export function CountdownTimer({ createdAt, deadline, className }: CountdownTimerProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (now === null) {
    // First client render before the effect runs — avoids an SSR/CSR
    // mismatch on a value that's inherently time-dependent.
    return null;
  }

  const totalMs = deadline.getTime() - new Date(createdAt).getTime();
  const remainingMs = deadline.getTime() - now;
  const state = classifyCountdown(remainingMs, totalMs);
  const isOverdue = state === 'overdue';

  return (
    <span
      role="timer"
      aria-label={
        isOverdue
          ? `Decision overdue by ${formatDuration(remainingMs)}`
          : `${formatDuration(remainingMs)} remaining to decide`
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
        STATE_CLASSES[state],
        className,
      )}
    >
      {isOverdue ? <AlarmClockOff className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {isOverdue ? `OVERDUE +${formatDuration(remainingMs)}` : formatDuration(remainingMs)}
    </span>
  );
}
