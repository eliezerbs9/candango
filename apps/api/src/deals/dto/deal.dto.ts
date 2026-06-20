import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDealDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  pipelineId!: string;

  @IsString()
  stageId!: string;

  @IsOptional()
  @IsString()
  primaryPersonId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}

export class LoseDealDto {
  @IsOptional()
  @IsString()
  lostReason?: string;
}
