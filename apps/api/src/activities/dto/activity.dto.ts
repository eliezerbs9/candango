import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const TYPES = ['call', 'meeting', 'task', 'email'] as const;

export class CreateActivityDto {
  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  personId?: string;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
