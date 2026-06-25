import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';

/** Public website contact form. No auth — protected by honeypot + rate limit + optional Turnstile. */
@Controller('contact')
export class ContactController {
  constructor(private readonly svc: ContactService) {}

  @Post()
  @HttpCode(200)
  submit(@Body() dto: ContactDto, @Ip() ip: string) {
    return this.svc.submit(dto, ip);
  }
}
