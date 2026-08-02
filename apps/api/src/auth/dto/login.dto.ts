import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  /** When the email exists in more than one workspace, the chosen workspace to sign into. */
  @IsOptional()
  @IsString()
  orgId?: string;
}
