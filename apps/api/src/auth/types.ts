import { Role } from '@prisma/client';

/** Claims encoded in the access JWT. */
export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: Role;
}

/**
 * Claims encoded in the short-lived token issued by POST /auth/login when an
 * account belongs to more than one tenant. Deliberately excludes tenantId/role
 * so it can never be mistaken for (or misused as) a full API access token —
 * JwtStrategy explicitly rejects any payload missing those fields.
 */
export interface TenantSelectionPayload {
  sub: string;
  purpose: 'tenant-selection';
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

export interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * Returned by POST /auth/login instead of AuthTokens when the account has
 * more than one tenant membership. The frontend collects a `tenantId` choice
 * from the user and calls POST /auth/select-tenant with it and this token to
 * complete login.
 */
export interface TenantSelectionRequired {
  tenantSelectionRequired: true;
  tenantSelectionToken: string;
  tenants: TenantOption[];
}
