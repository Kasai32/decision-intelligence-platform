import { cva, type VariantProps } from 'class-variance-authority';
import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold ' +
    'uppercase tracking-wide transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        critical: 'border-transparent bg-critical text-critical-foreground',
        high: 'border-transparent bg-high text-high-foreground',
        medium: 'border-transparent bg-medium text-medium-foreground',
        low: 'border-transparent bg-low text-low-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
