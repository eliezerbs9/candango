import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  /** Honeypot — a hidden field real users never fill. If present, we drop the message. */
  @IsOptional()
  @IsString()
  company?: string;

  /** Cloudflare Turnstile token (verified server-side when TURNSTILE_SECRET is set). */
  @IsOptional()
  @IsString()
  token?: string;
}
