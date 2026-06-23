import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const TYPES = ['call', 'meeting', 'task', 'email'] as const;
const LOCATION_TYPES = ['in_person', 'video', 'phone', 'none'] as const;

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
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(LOCATION_TYPES)
  locationType?: (typeof LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  conferenceUrl?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  // People involved. If omitted and a deal is set, defaults to the deal's people.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];
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
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(LOCATION_TYPES)
  locationType?: (typeof LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  conferenceUrl?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export interface ActivityFilters {
  dealId?: string;
  assignedUserId?: string;
  from?: string;
  to?: string;
  type?: string;
}
