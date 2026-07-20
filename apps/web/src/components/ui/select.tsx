import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * A native `<select>`, styled to match Input — not a Radix Select. This
 * surface only needs plain enum pickers (severity, risk level), so a native
 * element keeps keyboard/a11y behavior free instead of hand-rolling it.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
          'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
