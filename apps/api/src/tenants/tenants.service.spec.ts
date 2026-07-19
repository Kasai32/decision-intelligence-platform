import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let prisma: {
    tenant: { findUnique: jest.Mock; update: jest.Mock };
    membership: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    user: { findUnique: jest.Mock };
  };
  let service: TenantsService;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn(), update: jest.fn() },
      membership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn() },
    };
    service = new TenantsService(prisma as unknown as PrismaService);
  });

  describe('getById', () => {
    it('returns the tenant when found', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 't1', name: 'Acme' });
      await expect(service.getById('t1')).resolves.toEqual({ id: 't1', name: 'Acme' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addMember', () => {
    it('adds an existing user as a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'b@example.com', name: 'B' });
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.membership.create.mockResolvedValue({ role: Role.MEMBER });

      const result = await service.addMember('t1', { email: 'b@example.com', role: Role.MEMBER });
      expect(result).toEqual({
        userId: 'u1',
        email: 'b@example.com',
        name: 'B',
        role: Role.MEMBER,
      });
    });

    it('throws NotFoundException when no account exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.addMember('t1', { email: 'nobody@example.com', role: Role.MEMBER }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when already a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'b@example.com', name: 'B' });
      prisma.membership.findUnique.mockResolvedValue({ id: 'm1' });
      await expect(
        service.addMember('t1', { email: 'b@example.com', role: Role.MEMBER }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('throws NotFoundException when the membership does not exist', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.removeMember('t1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when trying to remove the OWNER', async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: 'm1', role: Role.OWNER });
      await expect(service.removeMember('t1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('removes a non-owner member', async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: 'm1', role: Role.MEMBER });
      prisma.membership.delete.mockResolvedValue({});
      await service.removeMember('t1', 'u1');
      expect(prisma.membership.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });
});
