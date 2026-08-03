import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { CUSTOM_FIELD_TYPES } from '../system-fields';

const ENTITIES = ['deal', 'person', 'company'] as const;
const TYPES = CUSTOM_FIELD_TYPES;

export class CreateCustomFieldDto {
  @IsIn(ENTITIES)
  entity!: (typeof ENTITIES)[number];

  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  requiredFromStageId?: string;

  @IsOptional()
  @IsBoolean()
  requiredForWon?: boolean;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  requiredFromStageId?: string | null;

  @IsOptional()
  @IsBoolean()
  requiredForWon?: boolean;

  @IsOptional()
  @IsInt()
  position?: number;
}
