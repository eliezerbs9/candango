import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
}

export class UpdateDocStatusDto {
  @IsString()
  @IsIn(['draft', 'sent', 'accepted', 'rejected', 'closed', 'paid', 'void'])
  status!: string;
}
