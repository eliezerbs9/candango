import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSignableDocumentDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  bodyHtml?: string;
}

export class UpdateSignableDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  bodyHtml?: string;
}

/** Generate a document from a template for a deal and send it for signature. */
export class GenerateSignatureDto {
  @IsString()
  dealId!: string;

  @IsString()
  signableDocumentTemplateId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  signerName?: string;

  @IsOptional()
  @IsEmail()
  signerEmail?: string;

  @IsOptional()
  sendEmail?: boolean;
}
