import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { generateOpaqueToken, hashToken } from './token.util';
import { AuthTokens, JwtPayload } from './types';

const REFRESH_TOKEN_TTL_DAYS = 30;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'tenant'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const baseSlug = slugify(dto.tenantName);

    const { user, membership } = await this.prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      for (let attempt = 0; await tx.tenant.findUnique({ where: { slug } }); attempt += 1) {
        slug = `${baseSlug}-${attempt + 2}`;
      }

      const tenant = await tx.tenant.create({ data: { name: dto.tenantName, slug } });
      const createdUser = await tx.user.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      const createdMembership = await tx.membership.create({
        data: { userId: createdUser.id, tenantId: tenant.id, role: Role.OWNER },
      });

      return { user: createdUser, membership: createdMembership };
    });

    return this.issueTokens(user.id, user.email, membership.tenantId, membership.role);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { memberships: true },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.memberships.length === 0) {
      throw new UnauthorizedException('This account is not a member of any tenant');
    }
    if (user.memberships.length > 1) {
      throw new UnauthorizedException(
        'This account belongs to multiple tenants; tenant selection is not yet supported',
      );
    }

    const membership = user.memberships[0];
    return this.issueTokens(user.id, user.email, membership.tenantId, membership.role);
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: stored.userId, tenantId: stored.tenantId } },
    });
    if (!membership) {
      throw new UnauthorizedException('Membership no longer exists');
    }

    return this.issueTokens(stored.userId, stored.user.email, stored.tenantId, membership.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string,
    role: Role,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, tenantId, role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { tokenHash: hashToken(refreshToken), userId, tenantId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
