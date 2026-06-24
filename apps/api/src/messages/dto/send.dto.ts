import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AttachmentDto {
  @IsString()
  @MinLength(1)
  filename!: string;

  @IsString()
  @MinLength(1)
  mimeType!: string;

  @IsString()
  contentBase64!: string;
}

export class SendMessageDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  to!: string[];

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  body!: string;

  /** body is HTML (rich-text composer) */
  @IsOptional()
  @IsBoolean()
  html?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsString()
  dealId?: string;

  // Reply threading
  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  inReplyTo?: string;
}
