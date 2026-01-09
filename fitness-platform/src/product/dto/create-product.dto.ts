import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, ProductCategory } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({
    description: 'The name of the product',
    example: 'Organic Whey Protein',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Digital or physical type of the product',
    enum: ProductType,
    example: 'DIGITAL',
  })
  @IsEnum(ProductType)
  type: ProductType;

  @ApiProperty({
    description: 'The category the product falls under',
    enum: ProductCategory,
    example: 'PROGRAMS',
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiPropertyOptional({
    description: 'A detailed description of the product',
    example: 'A video course on building muscle mass effectively.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Price of the product',
    example: 49.99,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  @Min(0)
  price: number;
}
