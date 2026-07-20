import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

/**
 * Structured request/response logging (critical-review remediation 2/5, see
 * DECISION_LOG.md). Replaces Nest's default console logger — plain
 * `Logger.log()` calls print unstructured text with no request
 * correlation, which is unusable for log aggregation/search in anything
 * beyond a single local terminal.
 *
 * Redaction is a hard requirement, not an afterthought: `credentials` is
 * the exact field name `ConfigureIntegrationDto` uses for a tenant's raw
 * integration secrets (see ADR-0012) — logging it verbatim would defeat
 * the point of encrypting it at rest.
 */
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.credentials',
            'req.body.accessToken',
            'req.body.refreshToken',
          ],
          censor: '[REDACTED]',
        },
        autoLogging: {
          ignore: (req) => req.url === '/health',
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
