import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // expiresIn is in seconds (a plain number) to avoid depending on the
        // `ms`-style branded string type re-exported by @nestjs/jwt. env vars
        // are always strings, so parse explicitly rather than trusting the
        // ConfigService generic.
        signOptions: {
          expiresIn: Number(configService.get<string>('JWT_ACCESS_TTL_SECONDS', '900')),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
