import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TEMPLATE_SCOPES } from '../template-vars';

const BODY_FORMATS = ['richtext', 'html'];

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  // Immutable after creation: the scope fixes which variable context the template renders against
  // and where it can be used, so an automation/send flow can trust it.
  @IsOptional()
  @IsIn(TEMPLATE_SCOPES)
  scope?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  body!: string;

  @IsOptional()
  @IsIn(BODY_FORMATS)
  bodyFormat?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  body?: string;

  @IsOptional()
  @IsIn(BODY_FORMATS)
  bodyFormat?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];
}
