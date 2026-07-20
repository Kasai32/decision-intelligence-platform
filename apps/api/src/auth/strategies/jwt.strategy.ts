import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    // Rejects the short-lived tenant-selection token (see AuthService.login /
    // TenantSelectionPayload) — it's signed with the same secret but carries
    // neither field, so it must never be usable as a full API credential.
    if (!payload.tenantId || !payload.role) {
      throw new UnauthorizedException('Invalid access token');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}
