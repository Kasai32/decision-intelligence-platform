import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../types';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

const baseUser: AuthenticatedUser = {
  userId: 'u1',
  email: 'u1@example.com',
  tenantId: 't1',
  role: Role.MEMBER,
};

describe('RolesGuard', () => {
  function makeGuard(requiredRoles: Role[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows access when no roles are required', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(contextWithUser(baseUser))).toBe(true);
  });

  it('denies access when there is no authenticated user', () => {
    const guard = makeGuard([Role.MEMBER]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });

  it('allows a MEMBER through a MEMBER-gated route', () => {
    const guard = makeGuard([Role.MEMBER]);
    expect(guard.canActivate(contextWithUser({ ...baseUser, role: Role.MEMBER }))).toBe(true);
  });

  it('denies a MEMBER on an ADMIN-gated route', () => {
    const guard = makeGuard([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ ...baseUser, role: Role.MEMBER }))).toBe(false);
  });

  it('allows an OWNER through an ADMIN-gated route (higher rank subsumes lower)', () => {
    const guard = makeGuard([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ ...baseUser, role: Role.OWNER }))).toBe(true);
  });

  it('allows an ADMIN through an OWNER-gated route only if rank is sufficient', () => {
    const guard = makeGuard([Role.OWNER]);
    expect(guard.canActivate(contextWithUser({ ...baseUser, role: Role.ADMIN }))).toBe(false);
  });
});
