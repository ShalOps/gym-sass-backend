import { IsString, IsInt } from 'class-validator';

export class CreateServiceOptionDto {
  @IsString()
  name: string;

  @IsInt()
  gymId: number;
}