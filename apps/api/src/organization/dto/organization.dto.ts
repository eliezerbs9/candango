import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  /** IANA workspace timezone (e.g. America/New_York). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

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

  /** Email signature HTML (with sender/company `{{variables}}`); empty string = no signature. */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  emailSignature?: string;
}
