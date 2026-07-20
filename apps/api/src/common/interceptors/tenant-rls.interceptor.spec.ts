import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';

function mockContext(user?: { tenantId?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('TenantRlsInterceptor', () => {
  let prisma: { $transaction: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let interceptor: TenantRlsInterceptor;
  let next: CallHandler;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb) => cb({ $executeRaw: jest.fn() })),
    };
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new TenantRlsInterceptor(
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
    next = { handle: jest.fn(() => of('response')) };
  });

  it('wraps the request in a tenant-scoped transaction when a JWT-authenticated user is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const result$ = interceptor.intercept(mockContext({ tenantId: 't1' }), next);
    await result$.toPromise();

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });

  it('passes through untouched for an unauthenticated route (no user on the request)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const result$ = interceptor.intercept(mockContext(undefined), next);
    await result$.toPromise();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });

  it('skips the transaction entirely for a route decorated with @SkipTenantRls() (see ADR-0020)', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result$ = interceptor.intercept(mockContext({ tenantId: 't1' }), next);
    await result$.toPromise();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });

  it("never collapses a multi-emission Observable — @SkipTenantRls() returns next.handle() completely untouched, so a streaming route's every emission still reaches the caller", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const emissions: string[] = [];
    next = { handle: jest.fn(() => of('chunk-1', 'chunk-2', 'chunk-3')) };

    const result$ = interceptor.intercept(mockContext({ tenantId: 't1' }), next);
    await new Promise<void>((resolve) => {
      result$.subscribe({
        next: (value) => emissions.push(value as string),
        complete: resolve,
      });
    });

    expect(emissions).toEqual(['chunk-1', 'chunk-2', 'chunk-3']);
  });
});
