import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const BODY_FORMATS = ['richtext', 'html'];

export class CreateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

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
