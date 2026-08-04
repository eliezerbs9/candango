import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export const INITIALS_RULES = ['none', 'every_page', 'specified_pages', 'last_page'] as const;
export type InitialsRule = (typeof INITIALS_RULES)[number];

/** A visually-placed field on a template (Phase 3). Coords normalized 0–1, page 1-indexed. */
export class DrawnFieldDto {
  @IsIn(['signature', 'initials', 'date', 'text', 'checkbox'])
  type!: 'signature' | 'initials' | 'date' | 'text' | 'checkbox';

  @IsInt()
  @Min(1)
  page!: number;

  @Type(() => Number)
  x!: number;

  @Type(() => Number)
  y!: number;

  @Type(() => Number)
  w!: number;

  @Type(() => Number)
  h!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}

export class CreateSignatureTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(INITIALS_RULES as unknown as string[])
  initialsRule?: InitialsRule;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  initialsPages?: number[];

  @IsOptional()
  @IsBoolean()
  acceptance?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  acceptanceText?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrawnFieldDto)
  fields?: DrawnFieldDto[];

  @IsOptional()
  @IsBoolean()
  requireCounterSigner?: boolean;
}

export class UpdateSignatureTemplateDto extends CreateSignatureTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;
}
