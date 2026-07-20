import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

const API_PREFIX = 'api/v1';

/**
 * Builds a real, fully-wired Nest application against the real (test
 * container) database — mirrors apps/api/src/main.ts's bootstrap exactly
 * for the pieces that affect request/response behavior (ValidationPipe,
 * exception filter, global prefix), so an e2e test exercises the same
 * contract a real client would. Deliberately skips `helmet()`/pino
 * (response headers/log format aren't what these tests are checking) and
 * `app.listen()` (supertest talks to the underlying HTTP server directly).
 */
export async function bootstrapTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();

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
