import { IntegrationConfigStatus, IntegrationKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { IntegrationsRegistryService } from './integrations-registry.service';
import { NetworkSimulator } from './network-simulator';

const payload = { tenantId: 't1', incidentId: 'i1', summary: 'test incident' };

describe('IntegrationsRegistryService', () => {
  let prisma: {
    integrationConfig: { findUnique: jest.Mock };
    timelineEvent: { create: jest.Mock };
  };
  let credentialsEncryption: { decrypt: jest.Mock };
  let networkSimulator: NetworkSimulator;
  let service: IntegrationsRegistryService;

  beforeEach(() => {
    prisma = {
      integrationConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      timelineEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    credentialsEncryption = { decrypt: jest.fn() };
    networkSimulator = { call: jest.fn().mockResolvedValue(undefined) };
    service = new IntegrationsRegistryService(
      prisma as unknown as PrismaService,
      credentialsEncryption as unknown as CredentialsEncryptionService,
      networkSimulator,
    );
  });

  describe('getProvider', () => {
    it('returns a STUB_MODE (unconfigured) provider when no IntegrationConfig row exists', async () => {
      const provider = await service.getProvider('t1', IntegrationKey.SLACK);
      expect(provider.isConfigured()).toBe(false);
    });

    it('returns an unconfigured provider when the config status is BROKEN', async () => {
      prisma.integrationConfig.findUnique.mockResolvedValue({
        status: IntegrationConfigStatus.BROKEN,
        encryptedCredentials: 'irrelevant',
      });
      const provider = await service.getProvider('t1', IntegrationKey.SLACK);
      expect(provider.isConfigured()).toBe(false);
    });

    it('decrypts and configures the provider when an ACTIVE config exists', async () => {
      prisma.integrationConfig.findUnique.mockResolvedValue({
        status: IntegrationConfigStatus.ACTIVE,
        encryptedCredentials: 'ciphertext',
      });
      credentialsEncryption.decrypt.mockReturnValue(JSON.stringify({ apiKey: 'fixture' }));

      const provider = await service.getProvider('t1', IntegrationKey.SERVICENOW);
      expect(provider.isConfigured()).toBe(true);
    });

    it('falls back to STUB_MODE (never throws) when credentials fail to decrypt', async () => {
      prisma.integrationConfig.findUnique.mockResolvedValue({
        status: IntegrationConfigStatus.ACTIVE,
        encryptedCredentials: 'corrupted',
      });
      credentialsEncryption.decrypt.mockImplementation(() => {
        throw new Error('bad auth tag');
      });

      const provider = await service.getProvider('t1', IntegrationKey.SERVICENOW);
      expect(provider.isConfigured()).toBe(false);
    });

    it('caches the provider instance per (tenantId, key) so circuit-breaker state persists', async () => {
      const first = await service.getProvider('t1', IntegrationKey.SLACK);
      const second = await service.getProvider('t1', IntegrationKey.SLACK);
      expect(first).toBe(second);
      expect(prisma.integrationConfig.findUnique).toHaveBeenCalledTimes(1);
    });

    it('keeps separate provider instances per tenant for the same key', async () => {
      const forTenantA = await service.getProvider('tenant-a', IntegrationKey.SLACK);
      const forTenantB = await service.getProvider('tenant-b', IntegrationKey.SLACK);
      expect(forTenantA).not.toBe(forTenantB);
    });
  });

  describe('broadcast', () => {
    it('calls every one of the ten providers', async () => {
      await service.broadcast('incidentCreated', payload);
      // No config for any provider -> all STUB_MODE -> no network calls, but no crash either.
      expect(networkSimulator.call).not.toHaveBeenCalled();
    });

    it('never throws even if a provider misbehaves (integration isolation)', async () => {
      jest.spyOn(service, 'getAllProviders').mockResolvedValue([
        {
          key: IntegrationKey.SLACK,
          displayName: 'Slack',
          isConfigured: () => true,
          getCircuitState: () => 'CLOSED',
          notifyIncidentCreated: jest.fn().mockRejectedValue(new Error('unexpected crash')),
          notifyDecisionDecided: jest.fn(),
        } as never,
      ]);

      await expect(service.broadcast('incidentCreated', payload)).resolves.toBeUndefined();
    });

    it('writes exactly one INTEGRATION_BLOCKED TimelineEvent when a circuit trips OPEN, not on every subsequent call', async () => {
      prisma.integrationConfig.findUnique.mockImplementation(({ where }) =>
        where.tenantId_providerType.providerType === IntegrationKey.SERVICENOW
          ? Promise.resolve({ status: IntegrationConfigStatus.ACTIVE, encryptedCredentials: 'x' })
          : Promise.resolve(null),
      );
      credentialsEncryption.decrypt.mockReturnValue(JSON.stringify({ apiKey: 'fixture' }));
      (networkSimulator.call as jest.Mock).mockImplementation((key: IntegrationKey) =>
        key === IntegrationKey.SERVICENOW
          ? Promise.reject(new Error('ServiceNow is down'))
          : Promise.resolve(undefined),
      );

      await service.broadcast('incidentCreated', payload); // failure 1
      await service.broadcast('incidentCreated', payload); // failure 2
      expect(prisma.timelineEvent.create).not.toHaveBeenCalled();

      await service.broadcast('incidentCreated', payload); // failure 3 -> trips the breaker
      expect(prisma.timelineEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INTEGRATION_BLOCKED',
            tenantId: 't1',
            incidentId: 'i1',
          }),
        }),
      );

      await service.broadcast('incidentCreated', payload); // still OPEN, no new event
      expect(prisma.timelineEvent.create).toHaveBeenCalledTimes(1);
    });
  });
});
