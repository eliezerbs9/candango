import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'denied', 'deferred'];

export class CreateProposalDto {
  @IsString()
  dealId!: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  estimateIds?: string[];
}

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  estimateIds?: string[];

  @IsOptional()
  @IsArray()
  content?: unknown[];

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}
