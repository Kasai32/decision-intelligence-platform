import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { rawBodySaver } from '../../src/common/raw-body';

const API_PREFIX = 'api/v1';

/**
 * Builds a real, fully-wired Nest application against the real (test
 * container) database — mirrors apps/api/src/main.ts's bootstrap exactly
 * for the pieces that affect request/response behavior (ValidationPipe,
 * exception filter, global prefix, and — critically — the raw-body-capturing
 * `json()`/`urlencoded()` middleware `WebhookSignatureGuard` depends on;
 * this was missing for a while and every e2e test except the webhook one
 * happened not to exercise the gap). Deliberately skips `helmet()`/pino
 * (response headers/log format aren't what these tests are checking) and
 * `app.listen()` (supertest talks to the underlying HTTP server directly).
 */
export async function bootstrapTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });

  app.use(json({ verify: rawBodySaver }));
  app.use(urlencoded({ verify: rawBodySaver, extended: true }));

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

  await app.init();
  return app;
}
