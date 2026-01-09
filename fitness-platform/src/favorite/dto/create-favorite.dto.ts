import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFavoriteDto {
  @ApiProperty({ example: 1, description: 'The ID of the product' })
  @IsInt()
  productId: number;
}
