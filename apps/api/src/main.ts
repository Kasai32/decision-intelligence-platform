import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { IncomingMessage } from 'node:http';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const API_PREFIX = 'api/v1';

/**
 * Captures the exact raw request bytes on `req.rawBody` (see ADR-0012) —
 * HMAC webhook signatures must be computed over the bytes actually
 * received, not a re-serialized JSON object, which can differ in
 * whitespace/key order and would make a valid signature fail verification.
 */
function rawBodySaver(
  req: IncomingMessage & { rawBody?: Buffer },
  _res: unknown,
  buffer: Buffer,
): void {
  if (buffer?.length) {
    req.rawBody = buffer;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    // Buffer bootstrap logs until the Pino logger below is wired up, so
    // nothing is lost/printed via Nest's default console logger first.
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // CSP disabled here: swagger-ui-express (mounted below at /api/v1/docs)
  // relies on inline scripts/styles that helmet's default CSP blocks. Every
  // other helmet protection (HSTS, X-Frame-Options, X-Content-Type-Options,
  // etc.) still applies. A CSP scoped to non-docs routes is a reasonable
  // future hardening step, not done here to keep this change additive.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(json({ verify: rawBodySaver }));
  app.use(urlencoded({ verify: rawBodySaver, extended: true }));

  app.enableCors();
  app.setGlobalPrefix(API_PREFIX, {
    exclude: ['health', { path: 'webhooks/(.*)', method: RequestMethod.ALL }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Decision Intelligence Platform API')
    .setDescription('Phase 2 — Platform core: Auth, RBAC, Tenant Management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, swaggerDocument);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
