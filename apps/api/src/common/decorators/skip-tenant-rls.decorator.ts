import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_RLS_KEY = 'skipTenantRls';

/**
 * Opts a route out of `TenantRlsInterceptor`'s automatic per-request
 * transaction (see ADR-0015, ADR-0020). For routes whose handler itself
 * needs to run longer than any single DB transaction should reasonably
 * stay open (e.g. an SSE stream awaiting a slow LLM call) — the handler is
 * responsible for establishing its own `runInTenantContext()` scope
 * narrowly around just its actual DB calls, the same pattern the
 * HMAC-authenticated webhook route already uses for a different reason.
 */
export const SkipTenantRls = () => SetMetadata(SKIP_TENANT_RLS_KEY, true);
