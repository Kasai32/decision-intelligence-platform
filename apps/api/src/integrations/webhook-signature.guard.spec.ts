import { createHmac } from 'node:crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { IntegrationConfigStatus, IntegrationKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { WebhookSignatureGuard } from './webhook-signature.guard';

const WEBHOOK_SECRET = 'whsec-fixture-abc123';
const RAW_BODY = Buffer.from(JSON.stringify({ incidentId: 'i1', summary: 'CPU spike' }));

function validSignature(body: Buffer, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function makeContext(
  params: Record<string, string>,
  headers: Record<string, string>,
  rawBody?: Buffer,
) {
  const request = {
    params,
    rawBody,
    header: (name: string) => headers[name.toLowerCase()],
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('WebhookSignatureGuard — adversarial: fake alert injection', () => {
  let prisma: { integrationConfig: { findUnique: jest.Mock }; $transaction: jest.Mock };
  let credentialsEncryption: { decrypt: jest.Mock };
  let guard: WebhookSignatureGuard;

  beforeEach(() => {
    prisma = {
      integrationConfig: { findUnique: jest.fn() },
      // getWebhookSecret() now wraps its lookup in runInTenantContext() (see
      // ADR-0015) — this fake $transaction just runs the callback with a
      // stub tx exposing $executeRaw (the RLS session-variable setter),
      // since the guard's own query goes through `this.prisma` directly,
      // not the transaction client, in this Prisma-mocked unit test.
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ $executeRaw: jest.fn() })),
    };
    credentialsEncryption = { decrypt: jest.fn() };
    guard = new WebhookSignatureGuard(
      prisma as unknown as PrismaService,
      credentialsEncryption as unknown as CredentialsEncryptionService,
    );
  });

  function configureActiveIntegration() {
    prisma.integrationConfig.findUnique.mockResolvedValue({
      status: IntegrationConfigStatus.ACTIVE,
      encryptedCredentials: 'ciphertext',
    });
    credentialsEncryption.decrypt.mockReturnValue(
      JSON.stringify({ webhookSecret: WEBHOOK_SECRET }),
    );
  }

  it('accepts a correctly signed payload', async () => {
    configureActiveIntegration();
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY) },
      RAW_BODY,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a payload with a fabricated/wrong signature (fake alert injection)', async () => {
    configureActiveIntegration();
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY, 'wrong-secret-guessed-by-attacker') },
      RAW_BODY,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a tampered body signed for a different payload (replay-with-modification)', async () => {
    configureActiveIntegration();
    const tamperedBody = Buffer.from(
      JSON.stringify({ incidentId: 'i1', summary: 'FABRICATED CRITICAL ALERT' }),
    );
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY) }, // signature computed for the ORIGINAL body
      tamperedBody, // but the attacker sends a different body
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the signature header is missing entirely', async () => {
    configureActiveIntegration();
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      {},
      RAW_BODY,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when no IntegrationConfig exists for the tenant/provider', async () => {
    prisma.integrationConfig.findUnique.mockResolvedValue(null);
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY) },
      RAW_BODY,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the integration config status is BROKEN', async () => {
    prisma.integrationConfig.findUnique.mockResolvedValue({
      status: IntegrationConfigStatus.BROKEN,
      encryptedCredentials: 'ciphertext',
    });
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY) },
      RAW_BODY,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown provider type in the URL', async () => {
    const context = makeContext(
      { tenantId: 't1', providerType: 'NOT_A_REAL_PROVIDER' },
      { 'x-signature': validSignature(RAW_BODY) },
      RAW_BODY,
    );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the stored credentials have no webhookSecret at all', async () => {
    prisma.integrationConfig.findUnique.mockResolvedValue({
      status: IntegrationConfigStatus.ACTIVE,
      encryptedCredentials: 'ciphertext',
    });
    credentialsEncryption.decrypt.mockReturnValue(
      JSON.stringify({ apiKey: 'no-webhook-secret-here' }),
    );
    const context = makeContext(
      { tenantId: 't1', providerType: IntegrationKey.SPLUNK },
      { 'x-signature': validSignature(RAW_BODY) },
      RAW_BODY,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
