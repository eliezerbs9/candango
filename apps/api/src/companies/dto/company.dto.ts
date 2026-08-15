import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];

  /** Per-contact title at this company, keyed by personId (e.g. { personId: "Procurement Manager" }). */
  @IsOptional()
  @IsObject()
  contactTitles?: Record<string, string>;

  /** The company's main contact person (a linked contact's personId). */
  @IsOptional()
  @IsString()
  primaryContactId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];

  /** Per-contact title at this company, keyed by personId (e.g. { personId: "Procurement Manager" }). */
  @IsOptional()
  @IsObject()
  contactTitles?: Record<string, string>;

  /** The company's main contact person (a linked contact's personId). */
  @IsOptional()
  @IsString()
  primaryContactId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
