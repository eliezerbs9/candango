import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSignatureDto {
  @IsString()
  dealId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  /** Spaces object key of the source PDF to sign (an appended acceptance page is added). */
  @IsString()
  fileKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  signerName?: string;

  @IsEmail()
  signerEmail!: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  /** Append an Acceptance & Signature page (default true). */
  @IsOptional()
  @IsBoolean()
  acceptance?: boolean;

  /** Add an initials field on every page. */
  @IsOptional()
  @IsBoolean()
  initialsEveryPage?: boolean;
}
