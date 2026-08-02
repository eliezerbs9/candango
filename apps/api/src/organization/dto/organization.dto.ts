import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { SignatureConfig } from '../../email-templates/template-vars';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000) // logo as a data URL (or an http(s) URL)
  logoUrl?: string;

  /** How a QuickBooks customer name is built from a person. */
  @IsOptional()
  @IsIn(['first_last', 'last_first'])
  qboNameFormat?: string;

  /** Sales-tax rate for LOCAL estimates, in basis points (700 = 7%). 0–5000 (0–50%). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  taxRateBps?: number;

  /** Pre-select "apply tax" when creating a new estimate/invoice. */
  @IsOptional()
  @IsBoolean()
  taxDefaultOn?: boolean;

  /** Email signature config `{ photo, name, email, phone, logo, text }` — normalized server-side. */
  @IsOptional()
  @IsObject()
  emailSignature?: SignatureConfig;
}
