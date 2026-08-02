import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'];

export class LinkQuickbooksDto {
  /** Nest the deal's sub-account under an existing QBO Customer (its id). */
  @IsOptional()
  @IsString()
  parentCustomerId?: string;

  /** When no parentCustomerId is given: create a parent Customer from the deal's client (default true). */
  @IsOptional()
  @IsBoolean()
  createParent?: boolean;
}

export class LineItemDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string; // unit of measure (e.g. "hour", "each")

  @IsInt()
  @Min(0)
  unitPrice!: number; // minor units

  @IsOptional()
  @IsString()
  itemId?: string; // QBO Product/Service ref
}

export class CreateDocDto {
  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lines!: LineItemDto[];

  // FR-13.11 — on estimate CREATE, how it affects the deal value:
  // `setAsValue` = this becomes the sole value estimate (unmarks the others);
  // `includeInValue` = add it to the value (sum). Both omitted = don't count.
  @IsOptional()
  @IsBoolean()
  includeInValue?: boolean;

  @IsOptional()
  @IsBoolean()
  setAsValue?: boolean;

  /** Sales-tax rate for a LOCAL estimate/invoice, in basis points (700 = 7%).
   *  0/omitted = no tax. Ignored for QuickBooks docs (QBO computes its own tax). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  taxRateBps?: number;

  /** For invoices: the local DealEstimate this was generated from. */
  @IsOptional()
  @IsString()
  sourceEstimateId?: string;
}

export class ConvertToInvoiceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  estimateIds!: string[];

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: string;
}

export class SendDocDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class IncludeInvoicesInValueDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  invoiceIds!: string[];

  @IsBoolean()
  include!: boolean;
}

export class IncludeInValueDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  estimateIds!: string[];

  @IsBoolean()
  include!: boolean;
}

export class UpdateDocStatusDto {
  @IsString()
  @IsIn(['draft', 'sent', 'accepted', 'rejected', 'closed', 'paid', 'void'])
  status!: string;
}
