import { IsString, IsBoolean, IsInt } from 'class-validator';

export class CreateServiceOptionDto {
  @IsString()
  name: string;

  @IsBoolean()
  included: boolean;

  @IsInt()
  serviceId: number;
}