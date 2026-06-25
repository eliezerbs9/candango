import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { contactEmail, inviteEmail, passwordResetEmail, verifyEmail, type RenderedEmail } from './templates';

/** A fully-rendered message handed to the worker, which sends it via Brevo. */
export interface EmailJob extends RenderedEmail {
  to: string;
  name?: string | null;
  /** Optional Reply-To (e.g. so support can reply straight to a contact-form sender). */
  replyTo?: { email: string; name?: string };
}

/**
 * Renders transactional emails and enqueues them on the `email` queue. The
 * actual Brevo send happens in apps/workers (EmailProcessor) — mirroring the
 * webhook delivery split so requests never block on the provider.
 */
@Injectable()
export class MailService {
  private readonly appUrl: string;
  private readonly contactInbox: string;

  constructor(
    @InjectQueue('email') private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:3000';
    this.contactInbox = config.get<string>('CONTACT_INBOX') ?? 'hello@candango.app';
  }

  private enqueue(job: EmailJob) {
    return this.queue.add('send', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 200,
      removeOnFail: 1000,
    });
  }

  sendInvite(to: string, name: string | null, orgName: string, token: string) {
    const link = `${this.appUrl}/accept-invite?token=${token}`;
    return this.enqueue({ to, name, ...inviteEmail({ name, orgName, link }) });
  }

  sendPasswordReset(to: string, name: string | null, token: string) {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    return this.enqueue({ to, name, ...passwordResetEmail({ name, link }) });
  }

  sendEmailVerification(to: string, name: string | null, token: string) {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    return this.enqueue({ to, name, ...verifyEmail({ name, link }) });
  }

  /** Website contact form → support inbox, with Reply-To set to the sender. */
  sendContactMessage(name: string, email: string, message: string) {
    return this.enqueue({
      to: this.contactInbox,
      replyTo: { email, name },
      ...contactEmail({ name, email, message }),
    });
  }
}
