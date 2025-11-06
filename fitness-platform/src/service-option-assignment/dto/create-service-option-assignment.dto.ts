import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceOptionAssignmentDto {
  @ApiProperty({
    description: 'ID of the service to assign the option to',
    example: 7,
  })
  @IsInt()
  serviceId: number;

  @ApiProperty({
    description: 'ID of the service option to assign',
    example: 12,
  })
  @IsInt()
  optionId: number;

  @ApiProperty({
    description: 'ID of the gym (must match both service and option)',
    example: 3,
  })
  @IsInt()
  gymId: number;
}
