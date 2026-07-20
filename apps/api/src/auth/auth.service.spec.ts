import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashToken } from './token.util';

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    tenant: { findUnique: jest.Mock; create: jest.Mock };
    membership: { create: jest.Mock; findUnique: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      tenant: { findUnique: jest.fn(), create: jest.fn() },
      membership: { create: jest.fn(), findUnique: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => unknown) => fn(prisma)),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('creates a tenant + owner user + membership, and returns tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'Acme', slug: 'acme' });
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'a@example.com', name: 'A' });
      prisma.membership.create.mockResolvedValue({
        id: 'm1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: Role.OWNER,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'a@example.com',
        password: 'correcthorsebattery',
        name: 'A',
        tenantName: 'Acme',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(prisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.OWNER }) }),
      );
    });

    it('rejects registration when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          email: 'a@example.com',
          password: 'correcthorsebattery',
          name: 'A',
          tenantName: 'Acme',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        memberships: [{ tenantId: 'tenant-1', role: Role.OWNER }],
      });

      await expect(
        service.login({ email: 'a@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues tokens for a correct single-tenant login', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        memberships: [{ tenantId: 'tenant-1', role: Role.OWNER }],
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@example.com', password: 'correct-password' });
      if ('tenantSelectionRequired' in result) {
        throw new Error('expected AuthTokens for a single-tenant login');
      }
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rejects a user with no tenant membership', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        memberships: [],
      });

      await expect(
        service.login({ email: 'a@example.com', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns a tenant selection token (not access tokens) for an account with multiple memberships', async () => {
      const passwordHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        passwordHash,
        memberships: [
          {
            tenantId: 'tenant-1',
            role: Role.OWNER,
            tenant: { id: 'tenant-1', name: 'Acme', slug: 'acme' },
          },
          {
            tenantId: 'tenant-2',
            role: Role.MEMBER,
            tenant: { id: 'tenant-2', name: 'Globex', slug: 'globex' },
          },
        ],
      });

      const result = await service.login({ email: 'a@example.com', password: 'correct-password' });

      if (!('tenantSelectionRequired' in result)) {
        throw new Error('expected TenantSelectionRequired for a multi-tenant login');
      }
      expect(result.tenantSelectionToken).toBe('signed.jwt.token');
      expect(result.tenants).toEqual([
        { id: 'tenant-1', name: 'Acme', slug: 'acme' },
        { id: 'tenant-2', name: 'Globex', slug: 'globex' },
      ]);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', purpose: 'tenant-selection' },
        { expiresIn: 300 },
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('selectTenant', () => {
    it('issues real tokens for a tenant the user actually belongs to', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'tenant-selection' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-2',
        role: Role.MEMBER,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.selectTenant({
        tenantSelectionToken: 'valid.token',
        tenantId: 'tenant-2',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-2' } },
      });
    });

    it('rejects an invalid or expired tenant selection token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.selectTenant({ tenantSelectionToken: 'garbage', tenantId: 'tenant-2' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token whose purpose is not tenant-selection (defense in depth vs. a normal access token being replayed here)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@example.com',
        tenantId: 'tenant-1',
        role: Role.OWNER,
      });

      await expect(
        service.selectTenant({ tenantSelectionToken: 'an-access-token', tenantId: 'tenant-2' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects selecting a tenant the user is not actually a member of', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'tenant-selection' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.selectTenant({
          tenantSelectionToken: 'valid.token',
          tenantId: 'someone-elses-tenant',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh({ refreshToken: 'nope' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a revoked refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        tokenHash: hashToken('opaque'),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
        userId: 'user-1',
        tenantId: 'tenant-1',
        user: { email: 'a@example.com' },
      });
      await expect(service.refresh({ refreshToken: 'opaque' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        tokenHash: hashToken('opaque'),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        userId: 'user-1',
        tenantId: 'tenant-1',
        user: { email: 'a@example.com' },
      });
      await expect(service.refresh({ refreshToken: 'opaque' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates a valid refresh token and returns new tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        tokenHash: hashToken('opaque'),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        userId: 'user-1',
        tenantId: 'tenant-1',
        user: { email: 'a@example.com' },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.membership.findUnique.mockResolvedValue({ role: Role.MEMBER });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh({ refreshToken: 'opaque' });

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt1' } }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('logout', () => {
    it('revokes the matching non-revoked refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.logout('opaque');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashToken('opaque'), revokedAt: null },
        }),
      );
    });
  });
});
