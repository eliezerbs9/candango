import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Paper dimensions in INCHES (Gotenberg uses inches), rotated for landscape. */
function paperInches(paperSize?: string, orientation?: string): { w: number; h: number } {
  const base = paperSize === 'a4' ? { w: 8.27, h: 11.69 } : { w: 8.5, h: 11 };
  return orientation === 'landscape' ? { w: base.h, h: base.w } : base;
}

/**
 * Renders HTML to PDF via a self-hosted Gotenberg (Chromium) service. Inert until GOTENBERG_URL is
 * set. Used to turn the visual document builder's layout into a signable PDF at generate time.
 */
@Injectable()
export class GotenbergService {
  private readonly url: string;

  constructor(config: ConfigService) {
    this.url = (config.get<string>('GOTENBERG_URL') ?? '').replace(/\/+$/, '');
  }

  get configured() {
    return !!this.url;
  }

  async htmlToPdf(html: string, opts?: { paperSize?: string; orientation?: string }): Promise<Buffer> {
    if (!this.configured) throw new ServiceUnavailableException('HTML→PDF is not configured (set GOTENBERG_URL).');
    const { w, h } = paperInches(opts?.paperSize, opts?.orientation);
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('paperWidth', String(w));
    form.append('paperHeight', String(h));
    form.append('marginTop', '0');
    form.append('marginBottom', '0');
    form.append('marginLeft', '0');
    form.append('marginRight', '0');
    form.append('printBackground', 'true');
    const res = await fetch(`${this.url}/forms/chromium/convert/html`, { method: 'POST', body: form });
    if (!res.ok) throw new BadRequestException(`Gotenberg ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
