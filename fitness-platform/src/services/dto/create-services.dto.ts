import { IsString, IsNumber, IsInt, IsEnum, IsNotEmpty } from 'class-validator';
import { Category } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({
    description: 'Name of the service (unique per gym)',
    example: 'Personal Training Package',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Price of the service',
    example: 99.99,
    type: 'number',
    format: 'float',
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Duration of the service (e.g., "1 month", "yearly")',
    example: '1 month',
  })
  @IsString()
  duration: string;

  @ApiProperty({
    description: 'Category of the service',
    enum: Category,
    example: Category.STRENGTH,
  })
  @IsEnum(Category)
  @IsNotEmpty()
  category: Category;

  @ApiProperty({
    description: 'Target audience or focus of the service',
    example: 'Female',
  })
  @IsString()
  target: string;

  @ApiProperty({
    description: 'ID of the gym this service belongs to',
    example: 3,
  })
  @IsInt()
  gymId: number;
}
