import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TokensService } from '../tokens/tokens.service';
import { BillingService } from '../billing/billing.service';
import { InviteUserDto, UpdateUserDto } from './dto/user.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  roleId: string | null;
  status: string;
  role: { name: string } | null;
};

const shape = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  roleId: u.roleId,
  role: u.role?.name ?? 'Member',
  status: u.status,
});

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly tokens: TokensService,
    private readonly billing: BillingService,
  ) {}

  async list(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(shape);
  }

  private async ensureRole(orgId: string, roleId?: string | null) {
    if (roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: roleId, orgId } });
      if (!role) throw new BadRequestException('Invalid role');
    }
  }

  async invite(orgId: string, dto: InviteUserDto) {
    await this.ensureRole(orgId, dto.roleId);
    const existing = await this.prisma.user.findFirst({ where: { orgId, email: dto.email } });
    if (existing) throw new ConflictException('A member with this email already exists');

    const org = await this.prisma.organization.findFirst({
      where: { id: orgId },
      select: { name: true, onboardingState: true },
    });
    const user = await this.prisma.user.create({
      data: { orgId, email: dto.email, name: dto.name ?? null, roleId: dto.roleId ?? null, status: 'invited' },
      include: { role: true },
    });

    // Only email the invite once onboarding is complete — invites created during onboarding are
    // dispatched together when the owner finishes setup (see sendPendingInvites / onboarding.completed).
    const onboardingDone = (org?.onboardingState as { completed?: boolean } | null)?.completed === true;
    if (onboardingDone) await this.sendInviteEmail(orgId, user.id, user.email, user.name, org?.name ?? '');

    // Keep the Stripe subscription quantity aligned with active seats (FR-10.7).
    void this.billing.syncSeats(orgId).catch(() => undefined);
    return shape(user);
  }

  private async sendInviteEmail(orgId: string, userId: string, email: string, name: string | null, orgName: string) {
    const token = await this.tokens.issue(orgId, userId, 'invite', INVITE_TTL_MS);
    await this.mail.sendInvite(email, name, orgName, token);
  }

  /** Dispatch invite emails deferred during onboarding — fired when the workspace finishes setup. */
  @OnEvent('onboarding.completed')
  async sendPendingInvites(payload: { orgId: string }) {
    const orgId = payload.orgId;
    const org = await this.prisma.organization.findFirst({ where: { id: orgId }, select: { name: true } });
    const invited = await this.prisma.user.findMany({
      where: { orgId, status: 'invited', deletedAt: null },
      select: { id: true, email: true, name: true },
    });
    for (const u of invited) {
      await this.sendInviteEmail(orgId, u.id, u.email, u.name, org?.name ?? '').catch(() => undefined);
    }
  }

  async update(orgId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, orgId } });
    if (!user) throw new NotFoundException('Member not found');
    if (dto.roleId !== undefined) await this.ensureRole(orgId, dto.roleId);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { roleId: dto.roleId, status: dto.status },
      include: { role: true },
    });
    if (dto.status !== undefined) void this.billing.syncSeats(orgId).catch(() => undefined);
    return shape(updated);
  }

  async deactivate(orgId: string, id: string, actingUserId: string) {
    if (id === actingUserId) throw new BadRequestException("You can't deactivate yourself");
    const user = await this.prisma.user.findFirst({ where: { id, orgId } });
    if (!user) throw new NotFoundException('Member not found');
    await this.prisma.user.update({ where: { id }, data: { status: 'deactivated' } });
    void this.billing.syncSeats(orgId).catch(() => undefined);
  }
}
