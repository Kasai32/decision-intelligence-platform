import { NotFoundException } from '@nestjs/common';
import { IntegrationConfigStatus, IntegrationKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { IntegrationConfigService } from './integration-config.service';
import { IntegrationsRegistryService } from './integrations-registry.service';

describe('IntegrationConfigService', () => {
  let prisma: {
    integrationConfig: {
      upsert: jest.Mock;
      update: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let credentialsEncryption: { encrypt: jest.Mock };
  let registry: { invalidate: jest.Mock; getProvider: jest.Mock };
  let service: IntegrationConfigService;

  const fakeProvider = (isConfigured: boolean, circuitState = 'CLOSED') => ({
    isConfigured: () => isConfigured,
    getCircuitState: () => circuitState,
  });

  beforeEach(() => {
    prisma = {
      integrationConfig: {
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    credentialsEncryption = { encrypt: jest.fn().mockReturnValue('ciphertext') };
    registry = {
      invalidate: jest.fn(),
      getProvider: jest.fn().mockResolvedValue(fakeProvider(true)),
    };
    service = new IntegrationConfigService(
      prisma as unknown as PrismaService,
      credentialsEncryption as unknown as CredentialsEncryptionService,
      registry as unknown as IntegrationsRegistryService,
    );
  });

  describe('configure', () => {
    it('encrypts credentials before persisting and never returns them', async () => {
      prisma.integrationConfig.upsert.mockResolvedValue({
        status: IntegrationConfigStatus.ACTIVE,
        updatedAt: new Date(),
      });

      const result = await service.configure('t1', IntegrationKey.SLACK, {
        apiKey: 'secret-fixture',
      });

      expect(credentialsEncryption.encrypt).toHaveBeenCalledWith(
        JSON.stringify({ apiKey: 'secret-fixture' }),
      );
      expect(prisma.integrationConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ encryptedCredentials: 'ciphertext' }),
        }),
      );
      expect(JSON.stringify(result)).not.toContain('secret-fixture');
    });

    it('invalidates the cached provider so the next call re-reads the new config', async () => {
      prisma.integrationConfig.upsert.mockResolvedValue({
        status: IntegrationConfigStatus.ACTIVE,
        updatedAt: new Date(),
      });
      await service.configure('t1', IntegrationKey.SLACK, { apiKey: 'x' });
      expect(registry.invalidate).toHaveBeenCalledWith('t1', IntegrationKey.SLACK);
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when no config exists yet', async () => {
      prisma.integrationConfig.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('t1', IntegrationKey.SLACK, IntegrationConfigStatus.BROKEN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates the status and invalidates the cache', async () => {
      prisma.integrationConfig.findUnique.mockResolvedValue({
        status: IntegrationConfigStatus.ACTIVE,
      });
      prisma.integrationConfig.update.mockResolvedValue({
        status: IntegrationConfigStatus.BROKEN,
        updatedAt: new Date(),
      });

      const result = await service.updateStatus(
        't1',
        IntegrationKey.SLACK,
        IntegrationConfigStatus.BROKEN,
      );
      expect(result.status).toBe(IntegrationConfigStatus.BROKEN);
      expect(registry.invalidate).toHaveBeenCalledWith('t1', IntegrationKey.SLACK);
    });
  });

  describe('listAll', () => {
    it('returns all ten integration keys, NOT_CONFIGURED for ones with no row', async () => {
      prisma.integrationConfig.findMany.mockResolvedValue([
        {
          providerType: IntegrationKey.SLACK,
          status: IntegrationConfigStatus.ACTIVE,
          updatedAt: new Date(),
        },
      ]);
      registry.getProvider.mockImplementation((tenantId: string, key: IntegrationKey) =>
        Promise.resolve(fakeProvider(key === IntegrationKey.SLACK)),
      );

      const result = await service.listAll('t1');
      expect(result).toHaveLength(Object.values(IntegrationKey).length);

      const slack = result.find((entry) => entry.providerType === IntegrationKey.SLACK);
      expect(slack?.status).toBe(IntegrationConfigStatus.ACTIVE);
      expect(slack?.configured).toBe(true);

      const jira = result.find((entry) => entry.providerType === IntegrationKey.JIRA);
      expect(jira?.status).toBe('NOT_CONFIGURED');
      expect(jira?.configured).toBe(false);
    });
  });

  describe('remove', () => {
    it('deletes the config row and invalidates the cache', async () => {
      prisma.integrationConfig.deleteMany.mockResolvedValue({ count: 1 });
      await service.remove('t1', IntegrationKey.SLACK);
      expect(prisma.integrationConfig.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', providerType: IntegrationKey.SLACK },
      });
      expect(registry.invalidate).toHaveBeenCalledWith('t1', IntegrationKey.SLACK);
    });
  });
});
