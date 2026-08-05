import { IsArray, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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
  @IsIn(['none', 'every_page', 'specified_pages', 'last_page'])
  initialsRule?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  initialsPages?: number[];

  @IsOptional()
  @IsIn(['client', 'sender', 'both'])
  initialsParty?: string;

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

  /** The chosen receiver person's id — resolves the receiver.* variables (name/title/email). */
  @IsOptional()
  @IsString()
  receiverPersonId?: string;

  /** The client party's heading on the signature page — a company name, or the individual client. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientPartyLabel?: string;

  @IsOptional()
  sendEmail?: boolean;

  /** When true, the deal owner (salesperson) counter-signs as a second party. */
  @IsOptional()
  bothParties?: boolean;
}
