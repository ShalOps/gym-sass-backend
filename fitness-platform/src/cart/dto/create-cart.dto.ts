import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCartDto {}



export class CreateCartItemDto {
  @ApiProperty({ example: 1, description: 'The ID of the product' })
  @IsInt()
  productId: number;

  @ApiProperty({ example: 1, description: 'Quantity to add', default: 1 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  @Min(1)
  quantity?: number = 1;
}