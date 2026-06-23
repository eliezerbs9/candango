import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const VISIBILITY = ['own', 'team', 'org'] as const;

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(VISIBILITY)
  visibility!: (typeof VISIBILITY)[number];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(VISIBILITY)
  visibility?: (typeof VISIBILITY)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes?: string[];
}
