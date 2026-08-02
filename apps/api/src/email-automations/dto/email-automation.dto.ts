import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TRIGGER_KEYS } from '../triggers';
import { AUTOMATION_CATEGORY_KEYS } from '../automation-categories';

const ACTIONS = ['send_email', 'create_activity'];

export class CreateEmailAutomationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(AUTOMATION_CATEGORY_KEYS)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @IsIn(TRIGGER_KEYS)
  trigger!: string;

  @IsIn(ACTIONS)
  action!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateEmailAutomationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(AUTOMATION_CATEGORY_KEYS)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  @IsOptional()
  @IsIn(TRIGGER_KEYS)
  trigger?: string;

  @IsOptional()
  @IsIn(ACTIONS)
  action?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
