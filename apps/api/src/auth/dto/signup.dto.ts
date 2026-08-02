import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  orgName!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  /** IANA timezone auto-detected from the browser at signup (e.g. America/New_York). */
  @IsOptional()
  @IsString()
  timezone?: string;
}
