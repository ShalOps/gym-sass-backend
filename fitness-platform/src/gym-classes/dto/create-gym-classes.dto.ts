import { IsString, IsNumber, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGymClassesDto {
  @ApiProperty({
    description: 'Name of the gym class',
    example: 'Aerobics',
  })
  @IsString()
  className: string;

  @ApiProperty({
    description: 'Price per session or package',
    example: 25.0,
    type: 'number',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Schedule of the class (e.g., days and times)',
    example: 'Mon, Wed, Fri at 6:00 PM',
  })
  @IsString()
  classSchedule: string;

  @ApiProperty({
    description: 'Maximum number of participants allowed',
    example: 20,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({
    description: 'Duration of each class session',
    example: '60 minutes',
  })
  @IsString()
  duration: string;

  @ApiProperty({
    description: 'ID of the gym where the class is held',
    example: 4,
  })
  @IsInt()
  gymId: number;

  @ApiProperty({
    description: 'ID of the trainer teaching the class',
    example: 8,
  })
  @IsInt()
  trainerId: number;
}