import { IsArray, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

const ENTITIES = ['deal', 'person', 'company'] as const;
const TYPES = ['text', 'number', 'date', 'select'] as const;

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
  @IsInt()
  position?: number;
}
