import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateEstimateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Unit of measure (e.g. "hour", "each"). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  /** Unit price in minor units (cents). Optional. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;
}

export class UpdateEstimateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;
}
