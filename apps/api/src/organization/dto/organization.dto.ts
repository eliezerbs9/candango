import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Rules that gate the deal "Mark won" button (global per workspace). */
export class WinRequirementsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stageIds?: string[];

  @IsOptional()
  @IsBoolean()
  requireAcceptedProposal?: boolean;

  @IsOptional()
  @IsBoolean()
  requireSignedDocument?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signedTemplateIds?: string[];

  @IsOptional()
  @IsBoolean()
  requireInvoice?: boolean;
}

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

  /** Win Requirements — rules that gate the deal "Mark won" button. */
  @IsOptional()
  @ValidateNested()
  @Type(() => WinRequirementsDto)
  winRequirements?: WinRequirementsDto;

  /** Which elements show on a pipeline deal card (booleans keyed by element). */
  @IsOptional()
  @IsObject()
  dealCardConfig?: Record<string, boolean>;
}
