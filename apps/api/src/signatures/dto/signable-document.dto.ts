import { IsArray, IsEmail, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

const MODES = ['html', 'builder', 'upload'];

export class CreateSignableDocumentDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(MODES)
  mode?: string;

  @IsOptional()
  @IsIn(['one', 'both'])
  parties?: string;

  @IsOptional()
  @IsIn(['owner', 'user'])
  party2Source?: string;

  @IsOptional()
  @IsString()
  party2UserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  bodyHtml?: string;

  @IsOptional()
  @IsArray()
  layout?: unknown[]; // CanvasPage[] (builder mode)

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>; // ProposalTheme (builder mode)

  @IsOptional()
  @IsString()
  fileKey?: string; // upload mode

  @IsOptional()
  @IsArray()
  fields?: unknown[]; // DrawnField[] (upload mode)
}

export class UpdateSignableDocumentDto extends CreateSignableDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare name: string;
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

  /** When true, the deal owner (salesperson) counter-signs as a second party. */
  @IsOptional()
  bothParties?: boolean;
}
