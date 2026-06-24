import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
const tsToDate = (s?: number | null) => (s ? new Date(s * 1000) : null);

type SubRow = {
  status: string;
  seats: number;
  pricePerSeat: number;
  currency: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  stripeSubscriptionId: string | null;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
  ) {}

  private priceId() {
    return this.config.get<string>('STRIPE_PRICE_ID') ?? '';
  }
  private appUrl() {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  /** Active (billable) seats = non-deleted, non-deactivated users. */
  private activeSeats(orgId: string) {
    return this.prisma.user
      .count({ where: { orgId, deletedAt: null, status: { not: 'deactivated' } } })
      .then((n) => Math.max(1, n));
  }

  /** Ensure a Subscription row + Stripe customer exist; lazily starts the 7-day trial from org creation. */
  private async ensure(orgId: string) {
    const existing = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (existing) return existing;
    const stripe = this.stripe.require();
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, createdAt: true } });
    if (!org) throw new NotFoundException('Organization not found');
    const customer = await stripe.customers.create({ name: org.name, metadata: { orgId } });
    return this.prisma.subscription.create({
      data: {
        orgId,
        stripeCustomerId: customer.id,
        status: 'trialing',
        trialEndsAt: new Date(org.createdAt.getTime() + TRIAL_MS),
        seats: await this.activeSeats(orgId),
      },
    });
  }

  async status(orgId: string) {
    const sub = await this.ensure(orgId);
    const seats = await this.activeSeats(orgId);
    const invoices = await this.prisma.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const trialDaysLeft = sub.trialEndsAt
      ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;
    return {
      status: sub.status,
      seats,
      pricePerSeat: sub.pricePerSeat,
      currency: sub.currency,
      monthlyTotal: seats * sub.pricePerSeat,
      trialEndsAt: sub.trialEndsAt,
      trialDaysLeft,
      currentPeriodEnd: sub.currentPeriodEnd,
      canceledAt: sub.canceledAt,
      hasSubscription: !!sub.stripeSubscriptionId,
      locked: this.isLocked(sub),
      invoices: invoices.map((i) => ({
        id: i.id,
        amountDue: i.amountDue,
        amountPaid: i.amountPaid,
        currency: i.currency,
        status: i.status,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        hostedInvoiceUrl: i.hostedInvoiceUrl,
        createdAt: i.createdAt,
      })),
    };
  }

  /** Read-only lock: trial elapsed (or dunning exhausted) without an active paid subscription. */
  private isLocked(sub: SubRow) {
    if (sub.status === 'active') return false;
    if (sub.status === 'trialing') return !!sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now();
    return sub.status === 'past_due' || sub.status === 'canceled' || sub.status === 'locked';
  }

  /** Hosted Stripe Checkout to start a paid per-seat subscription. */
  async checkout(orgId: string) {
    const sub = await this.ensure(orgId);
    const stripe = this.stripe.require();
    if (!this.priceId()) throw new BadRequestException('STRIPE_PRICE_ID is not configured');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: sub.stripeCustomerId,
      line_items: [{ price: this.priceId(), quantity: await this.activeSeats(orgId) }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { orgId } },
      success_url: `${this.appUrl()}/settings/billing?checkout=success`,
      cancel_url: `${this.appUrl()}/settings/billing?checkout=cancel`,
    });
    return { url: session.url };
  }

  /** Hosted Customer Portal to manage card / cancel / invoices. */
  async portal(orgId: string) {
    const sub = await this.ensure(orgId);
    const stripe = this.stripe.require();
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.appUrl()}/settings/billing`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.stripe.require();
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.finalized':
        await this.syncInvoice(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
    return { received: true };
  }

  private mapStatus(s: string): string {
    if (s === 'active') return 'active';
    if (s === 'trialing') return 'trialing';
    if (s === 'past_due' || s === 'unpaid') return 'past_due';
    if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
    return s;
  }

  private async syncSubscription(s: Stripe.Subscription) {
    const customerId = typeof s.customer === 'string' ? s.customer : s.customer.id;
    const sub = await this.prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    if (!sub) return;
    const item = s.items.data[0];
    // current_period_end moved onto items in recent API versions — read defensively.
    const periodEnd =
      (s as unknown as { current_period_end?: number }).current_period_end ??
      (item as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      null;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        stripeSubscriptionId: s.id,
        stripePriceId: item?.price.id ?? null,
        status: this.mapStatus(s.status),
        seats: item?.quantity ?? sub.seats,
        currentPeriodEnd: tsToDate(periodEnd),
        canceledAt: tsToDate(s.canceled_at),
        trialEndsAt: tsToDate(s.trial_end) ?? sub.trialEndsAt,
      },
    });
  }

  private async syncInvoice(inv: Stripe.Invoice) {
    const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
    if (!customerId || !inv.id) return;
    const sub = await this.prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    if (!sub) return;
    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: inv.id },
      create: {
        orgId: sub.orgId,
        stripeInvoiceId: inv.id,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: (inv.currency ?? 'usd').toUpperCase(),
        status: inv.status ?? 'open',
        periodStart: tsToDate(inv.period_start),
        periodEnd: tsToDate(inv.period_end),
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      },
      update: {
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        status: inv.status ?? 'open',
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      },
    });
    if (inv.status === 'paid' && sub.status !== 'active') {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'active' } });
    }
  }
}
