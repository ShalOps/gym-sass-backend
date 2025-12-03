import { IsString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceOptionDto {
  @ApiProperty({
    description: 'Name of the service option (unique per gym)',
    example: 'Shower',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'ID of the gym this option belongs to',
    example: 3,
  })
  @IsInt()
  gymId: number;
}
