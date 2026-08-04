import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { DrawnFieldDto } from './signature-template.dto';

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

  /** Apply a saved SignatureTemplate's field rules (overrides the inline flags below). */
  @IsOptional()
  @IsString()
  signatureTemplateId?: string;

  /** Append an Acceptance & Signature page (default true) — inline mode. */
  @IsOptional()
  @IsBoolean()
  acceptance?: boolean;

  /** Add an initials field on every page — inline mode. */
  @IsOptional()
  @IsBoolean()
  initialsEveryPage?: boolean;

  /** Per-request visually-placed fields (Phase 3). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrawnFieldDto)
  drawnFields?: DrawnFieldDto[];
}
