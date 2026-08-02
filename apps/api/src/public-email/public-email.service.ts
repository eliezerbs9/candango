import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public (unauthenticated) email-preference management, reached from the unsubscribe link in
 * marketing emails. Lookups are by the person's opaque `emailUnsubToken`, so there is no tenant
 * context — these queries run with RLS bypassed (see PrismaService), which is why we scope every
 * read/write by the token alone and never expose an org id.
 */
@Injectable()
export class PublicEmailService {
  constructor(private readonly prisma: PrismaService) {}

  private async findByToken(token: string) {
    const person = await this.prisma.person.findFirst({
      where: { emailUnsubToken: token, deletedAt: null },
      select: {
        id: true,
        emails: true,
        emailSubscribed: true,
        organization: { select: { name: true } },
      },
    });
    if (!person) throw new NotFoundException('This link is no longer valid.');
    return person;
  }

  private view(p: {
    emails: unknown;
    emailSubscribed: boolean;
    organization: { name: string };
  }) {
    const emails = (p.emails as string[]) ?? [];
    return {
      email: emails[0] ?? null,
      workspaceName: p.organization.name,
      subscribed: p.emailSubscribed,
    };
  }

  async status(token: string) {
    return this.view(await this.findByToken(token));
  }

  async setSubscribed(token: string, subscribed: boolean) {
    const person = await this.findByToken(token);
    await this.prisma.person.update({
      where: { id: person.id },
      data: { emailSubscribed: subscribed, emailUnsubscribedAt: subscribed ? null : new Date() },
    });
    return this.view({ ...person, emailSubscribed: subscribed });
  }
}
