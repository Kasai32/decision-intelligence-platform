import { Role } from '@prisma/client';

/** Claims encoded in the access JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: Role;
}

/** Shape attached to `request.user` by JwtStrategy, and returned by @CurrentUser(). */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
