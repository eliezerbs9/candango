import { IsArray, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProposalTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  layout?: unknown[];

  @IsOptional()
  @IsString()
  emailTemplateId?: string;
}

export class UpdateProposalTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  layout?: unknown[];

  @IsOptional()
  @IsString()
  emailTemplateId?: string;
}
