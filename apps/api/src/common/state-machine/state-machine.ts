import { BadRequestException } from '@nestjs/common';

export type TransitionMap<T extends string> = Record<T, readonly T[]>;

/**
 * Generic finite-state-machine guard (see ADR-0007). Throws unless `to` is
 * explicitly listed as reachable from `from` in `allowed`. A same-state
 * "transition" (from === to) is NOT a free no-op — it must be explicitly
 * allowed like any other transition. This matters for entities like
 * Decision, where re-"deciding" an already-DECIDED row must be rejected,
 * not silently accepted because the target happens to match the current
 * state.
 */
export function assertValidTransition<T extends string>(
  entityName: string,
  allowed: TransitionMap<T>,
  from: T,
  to: T,
): void {
  const allowedNext = allowed[from] ?? [];
  if (!allowedNext.includes(to)) {
    throw new BadRequestException(
      `Invalid ${entityName} transition: ${from} -> ${to}. Allowed from ${from}: ${
        allowedNext.length > 0 ? allowedNext.join(', ') : '(none — terminal state)'
      }`,
    );
  }
}
