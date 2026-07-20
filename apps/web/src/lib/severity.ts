import type { IncidentSeverity } from '@dip/shared';

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

/** Matches the `critical`/`high`/`medium`/`low` Badge variants 1:1 (see ADR-0014). */
export function severityBadgeVariant(
  severity: IncidentSeverity,
): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
  }
}

/** Left-border accent color for incident list rows — same token as the badge. */
export function severityBorderClass(severity: IncidentSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'border-l-critical';
    case 'HIGH':
      return 'border-l-high';
    case 'MEDIUM':
      return 'border-l-medium';
    case 'LOW':
      return 'border-l-low';
  }
}
