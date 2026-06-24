import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/** Thin wrapper over the Stripe SDK; null when STRIPE_SECRET_KEY isn't configured. */
@Injectable()
export class StripeService {
  readonly client: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.client = key ? new Stripe(key) : null;
  }

  get enabled() {
    return !!this.client;
  }

  require(): Stripe {
    if (!this.client) throw new BadRequestException('Billing is not configured (set STRIPE_SECRET_KEY)');
    return this.client;
  }
}
