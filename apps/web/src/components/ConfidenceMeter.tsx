import { cn } from '../lib/utils';

export interface ConfidenceMeterProps {
  label: string;
  value: number;
}

/**
 * One of the four independent confidence dimensions (see ADR-0010) — always
 * rendered as its own labeled bar, never merged into a single score.
 */
export function ConfidenceMeter({ label, value }: ConfidenceMeterProps) {
  const colorClass = value >= 70 ? 'bg-success' : value >= 40 ? 'bg-medium' : 'bg-destructive';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
