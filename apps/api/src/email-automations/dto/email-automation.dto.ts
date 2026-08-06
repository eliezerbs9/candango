import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TRIGGER_KEYS } from '../triggers';
import { AUTOMATION_CATEGORY_KEYS } from '../automation-categories';
import type { MarketingSchedule } from '../marketing-schedule';
import type { MarketingAudience } from '../marketing-audience';

const ACTIONS = ['send_email', 'create_activity', 'request_signature', 'move_stage', 'add_tag'];

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

/**
 * Marketing automation: a scheduled broadcast to an audience. `schedule`/`audience` shapes are
 * validated in the service against marketing-schedule.ts / marketing-audience.ts.
 */
export class CreateMarketingAutomationDto {
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

  @IsString()
  templateId!: string;

  @IsString()
  timezone!: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsObject()
  schedule!: MarketingSchedule;

  @IsObject()
  audience!: MarketingAudience;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateMarketingAutomationDto {
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
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsObject()
  schedule?: MarketingSchedule;

  @IsOptional()
  @IsObject()
  audience?: MarketingAudience;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
