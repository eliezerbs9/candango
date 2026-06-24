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

  private resolvedPrice: string | null = null;
  /** Accept either a price id (`price_…`) or a product id (`prod_…`, resolved to its active price). */
  private async resolvePriceId(): Promise<string> {
    const id = this.priceId();
    if (!id) throw new BadRequestException('STRIPE_PRICE_ID is not configured');
    if (id.startsWith('price_')) return id;
    if (this.resolvedPrice) return this.resolvedPrice;
    if (id.startsWith('prod_')) {
      const prices = await this.stripe.require().prices.list({ product: id, active: true, limit: 1 });
      const price = prices.data[0];
      if (!price) throw new BadRequestException(`No active price found for product ${id}`);
      this.resolvedPrice = price.id;
      return price.id;
    }
    return id;
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
    return this.isLockedStatus(sub.status, sub.trialEndsAt);
  }

  private isLockedStatus(status: string, trialEndsAt: Date | null) {
    if (status === 'active') return false;
    if (status === 'trialing') return !!trialEndsAt && trialEndsAt.getTime() < Date.now();
    return status === 'past_due' || status === 'canceled' || status === 'locked';
  }

  /**
   * Cheap lock check for the write guard (FR-10.5) — never creates a Stripe customer.
   * Falls back to the implicit 7-day trial from org creation when no subscription row exists yet.
   */
  async isOrgLocked(orgId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({
      where: { orgId },
      select: { status: true, trialEndsAt: true },
    });
    if (sub) return this.isLockedStatus(sub.status, sub.trialEndsAt);
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { createdAt: true } });
    if (!org) return false;
    return org.createdAt.getTime() + TRIAL_MS < Date.now();
  }

  /**
   * Keep the Stripe subscription quantity aligned with the active-seat count (FR-10.7).
   * Called fire-and-forget after members are invited/deactivated/reactivated; never throws.
   */
  async syncSeats(orgId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!sub) return;
    const seats = await this.activeSeats(orgId);
    if (sub.stripeSubscriptionId && this.stripe.enabled) {
      const stripe = this.stripe.require();
      const remote = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const item = remote.items.data[0];
      if (item && item.quantity !== seats) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          items: [{ id: item.id, quantity: seats }],
          proration_behavior: 'create_prorations',
        });
      }
    }
    if (sub.seats !== seats) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { seats } });
    }
  }

  /** Hosted Stripe Checkout to start a paid per-seat subscription. */
  async checkout(orgId: string) {
    const sub = await this.ensure(orgId);
    const stripe = this.stripe.require();
    const price = await this.resolvePriceId();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: sub.stripeCustomerId,
      line_items: [{ price, quantity: await this.activeSeats(orgId) }],
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
    const status = this.mapStatus(s.status);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        stripeSubscriptionId: s.id,
        stripePriceId: item?.price.id ?? null,
        status,
        seats: item?.quantity ?? sub.seats,
        currentPeriodEnd: tsToDate(periodEnd),
        canceledAt: tsToDate(s.canceled_at),
        trialEndsAt: tsToDate(s.trial_end) ?? sub.trialEndsAt,
      },
    });
    // Keep org.plan in sync so any plan-gated UI reflects the subscription.
    await this.prisma.organization.update({
      where: { id: sub.orgId },
      data: { plan: status === 'active' ? 'standard' : 'trial' },
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
