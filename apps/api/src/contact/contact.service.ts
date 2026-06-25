import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ContactDto } from './dto/contact.dto';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_WINDOW = 5;

/**
 * Handles public website contact-form submissions. Defense in depth against spam:
 *  - honeypot field (bots fill it; humans never see it),
 *  - a simple per-IP rate limit,
 *  - optional Cloudflare Turnstile verification (active when TURNSTILE_SECRET is set).
 * Valid messages are emailed to the support inbox via the existing Brevo pipeline.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly hits = new Map<string, number[]>();
  private readonly turnstileSecret?: string;

  constructor(
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.turnstileSecret = config.get<string>('TURNSTILE_SECRET');
  }

  async submit(dto: ContactDto, ip: string): Promise<{ ok: true }> {
    // Honeypot: pretend success so bots don't learn they were caught.
    if (dto.company && dto.company.trim().length > 0) {
      this.logger.warn(`Contact honeypot triggered from ${ip}`);
      return { ok: true };
    }

    this.enforceRateLimit(ip);
    await this.verifyTurnstile(dto.token, ip);

    await this.mail.sendContactMessage(dto.name.trim(), dto.email.trim(), dto.message.trim());
    return { ok: true };
  }

  private enforceRateLimit(ip: string) {
    const now = Date.now();
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
      throw new BadRequestException('Too many messages — please try again later.');
    }
    recent.push(now);
    this.hits.set(ip, recent);
  }

  private async verifyTurnstile(token: string | undefined, ip: string) {
    if (!this.turnstileSecret) return; // not configured → skip (honeypot still applies)
    if (!token) throw new BadRequestException('Verification required.');
    const body = new URLSearchParams({ secret: this.turnstileSecret, response: token, remoteip: ip });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const ok = res && res.ok && ((await res.json().catch(() => ({}))) as { success?: boolean }).success;
    if (!ok) throw new BadRequestException('Verification failed — please try again.');
  }
}
