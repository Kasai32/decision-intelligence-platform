import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface ConfidenceMeterProps {
  label: string;
  value: number;
  /**
   * The "show your work" explanation for this score (see ADR-0019) —
   * optional so callers with no per-analysis breakdown (e.g. the aggregate
   * `/calibration` report) can keep using this component unchanged.
   * Rendered as a native, keyboard-accessible disclosure so no score is
   * ever presented as an unexplained number.
   */
  explanation?: ReactNode;
}

/**
 * One of the four independent confidence dimensions (see ADR-0010) — always
 * rendered as its own labeled bar, never merged into a single score.
 */
export function ConfidenceMeter({ label, value, explanation }: ConfidenceMeterProps) {
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
      {explanation && (
        <details className="group mt-0.5">
          <summary className="cursor-pointer text-[11px] text-primary hover:underline">
            Why this score?
          </summary>
          <div className="mt-1.5 rounded-sm border border-border bg-muted/50 p-2 text-xs text-muted-foreground">
            {explanation}
          </div>
        </details>
      )}
    </div>
  );
}
