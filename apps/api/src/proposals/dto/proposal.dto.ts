import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'denied', 'deferred'];

export class SendProposalDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  to?: string[];
}

/** A recipient's response on the public presentation page. Feedback is required to deny/defer. */
export class RespondProposalDto {
  @IsIn(['accepted', 'denied', 'deferred'])
  decision!: 'accepted' | 'denied' | 'deferred';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

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

  /** Rep-filled values for the proposal's internal (client-hidden) fields, keyed by field key. */
  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;

  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

  /** Reason/note — required when the user sets the status to denied or deferred. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
