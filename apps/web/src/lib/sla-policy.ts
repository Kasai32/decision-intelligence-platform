import type { IncidentSeverity } from '@dip/shared';

/**
 * Deterministic, disclosed SLA response-window policy (see ADR-0014). Not
 * fabricated data: the countdown is computed from two real fields
 * (`decision.createdAt`, `incident.severity`) already returned by the
 * existing Command Center endpoint — this table is the only new
 * assumption, and it's a UI-only placeholder pending a real, configurable
 * SLA policy (see memory/context.md open questions), not a backend change.
 */
export const SLA_MINUTES_BY_SEVERITY: Record<IncidentSeverity, number> = {
  CRITICAL: 15,
  HIGH: 60,
  MEDIUM: 4 * 60,
  LOW: 24 * 60,
};

export function computeDecisionDeadline(
  decisionCreatedAt: string,
  severity: IncidentSeverity,
): Date {
  const createdAtMs = new Date(decisionCreatedAt).getTime();
  return new Date(createdAtMs + SLA_MINUTES_BY_SEVERITY[severity] * 60_000);
}

export type CountdownState = 'calm' | 'warning' | 'danger' | 'overdue';

/**
 * `remainingMs`/`totalMs` drive the escalation: calm above 50% of the
 * window left, warning above 20%, danger down to zero, overdue past the
 * deadline.
 */
export function classifyCountdown(remainingMs: number, totalMs: number): CountdownState {
  if (remainingMs <= 0) {
    return 'overdue';
  }
  const fractionRemaining = totalMs > 0 ? remainingMs / totalMs : 0;
  if (fractionRemaining > 0.5) {
    return 'calm';
  }
  if (fractionRemaining > 0.2) {
    return 'warning';
  }
  return 'danger';
}

/** "1h 04m" for windows >= 1h, "04:32" (ticking mm:ss) below that — the shorter format reads as an active countdown for urgent SLAs. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
