import { IsString, IsNumber, IsInt } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  duration: string;

  @IsString()
  category: string;

  @IsString()
  target: string;

  @IsInt()
  gymId: number;
}