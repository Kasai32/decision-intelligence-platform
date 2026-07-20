import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { rawBodySaver } from './common/raw-body';

const API_PREFIX = 'api/v1';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    // Buffer bootstrap logs until the Pino logger below is wired up, so
    // nothing is lost/printed via Nest's default console logger first.
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Strict CSP everywhere by default. swagger-ui-express (mounted below at
  // /api/v1/docs) needs inline scripts/styles to render, so that one path
  // gets a second, more permissive helmet pass that overrides just the CSP
  // header for it — every other route keeps the strict default.
  app.use(helmet());
  app.use(
    `/${API_PREFIX}/docs`,
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
  );
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
