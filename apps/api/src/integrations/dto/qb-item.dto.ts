import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateQbItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  /** Unit price in minor units (cents). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}

export class UpdateQbItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;

  @IsOptional()
  @IsBoolean()
  taxable?: boolean;
}
