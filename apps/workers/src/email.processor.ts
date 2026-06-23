import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';

interface EmailJob {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
  text: string;
}

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

/** Sends a fully-rendered transactional email via the Brevo API; throws to trigger BullMQ retries. */
@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly apiKey?: string;
  private readonly from: string;
  private readonly fromName: string;

  constructor(config: ConfigService) {
    super();
    this.apiKey = config.get<string>('BREVO_API_KEY');
    this.from = config.get<string>('EMAIL_FROM') ?? 'no-reply@candango.app';
    this.fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'Candango';
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const { to, name, subject, html, text } = job.data;

    // Dev fallback: without a Brevo key, log instead of failing so flows are testable.
    if (!this.apiKey) {
      // eslint-disable-next-line no-console
      console.warn(`[email] BREVO_API_KEY not set — would send "${subject}" to ${to}`);
      return;
    }

    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.from, name: this.fromName },
        to: [{ email: to, ...(name ? { name } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo send failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
    }
  }
}
