import { IsString, IsNumber, IsInt, IsEnum, IsNotEmpty } from 'class-validator';
import { Category } from '@prisma/client';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  duration: string;

  @IsEnum(Category)
  @IsNotEmpty()
  category: Category;

  @IsString()
  target: string;

  @IsInt()
  gymId: number;
}