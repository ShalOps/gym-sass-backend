import { IsString, IsBoolean, IsInt } from 'class-validator';

export class UpdateSingleServiceOptionDto {
  @IsInt()
  optionId: number;

  @IsString()
  name: string;

  @IsBoolean()
  included: boolean;
}