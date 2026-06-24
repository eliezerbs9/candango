import { ArrayNotEmpty, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

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
