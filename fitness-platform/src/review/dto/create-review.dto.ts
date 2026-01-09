import { IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ example: 1, description: 'The ID of the product' })
  @IsInt()
  productId: number;

  @ApiProperty({
    example: 'This product was great',
    description: 'comment given for the product',
  })
  @IsString()
  comment: string;
}
