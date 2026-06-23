import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @MinLength(8)
  password!: string;
}

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @MinLength(8)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}
