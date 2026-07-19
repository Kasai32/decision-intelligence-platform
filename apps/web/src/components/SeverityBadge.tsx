import type { IncidentSeverity } from '@dip/shared';
import { AlertTriangle, Flame, Info, ShieldAlert } from 'lucide-react';
import { Badge } from './ui/badge';
import { SEVERITY_LABEL, severityBadgeVariant } from '../lib/severity';

const SEVERITY_ICON: Record<IncidentSeverity, typeof Flame> = {
  CRITICAL: Flame,
  HIGH: AlertTriangle,
  MEDIUM: ShieldAlert,
  LOW: Info,
};

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const Icon = SEVERITY_ICON[severity];
  return (
    <Badge variant={severityBadgeVariant(severity)}>
      <Icon className="h-3 w-3" />
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}
