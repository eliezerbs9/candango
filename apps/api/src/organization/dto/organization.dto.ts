import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
