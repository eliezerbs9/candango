import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
