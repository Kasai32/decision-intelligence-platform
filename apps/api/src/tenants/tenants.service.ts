import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

export interface MemberSummary {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.getById(tenantId);
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  async listMembers(tenantId: string): Promise<MemberSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
    }));
  }

  async addMember(tenantId: string, dto: AddMemberDto): Promise<MemberSummary> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException(
        'No account exists for this email yet — ask them to register first',
      );
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (existing) {
      throw new ConflictException('This user is already a member of the tenant');
    }

    const membership = await this.prisma.membership.create({
      data: { userId: user.id, tenantId, role: dto.role },
    });

    return { userId: user.id, email: user.email, name: user.name, role: membership.role };
  }

  async removeMember(tenantId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.role === Role.OWNER) {
      throw new ForbiddenException('Cannot remove the tenant owner');
    }

    await this.prisma.membership.delete({ where: { id: membership.id } });
  }
}
