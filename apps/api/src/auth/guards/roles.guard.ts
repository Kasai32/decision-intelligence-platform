import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** Higher rank subsumes lower: an OWNER satisfies an @Roles(Role.MEMBER) requirement. */
const ROLE_RANK: Record<Role, number> = {
  [Role.MEMBER]: 0,
  [Role.ADMIN]: 1,
  [Role.OWNER]: 2,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const minimumRequiredRank = Math.min(...requiredRoles.map((role) => ROLE_RANK[role]));
    return ROLE_RANK[user.role] >= minimumRequiredRank;
  }
}
