import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkoutPlanRequestDto {
  @ApiProperty({
    description: 'The user ID requesting a workout plan',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({
    description: 'User fitness level',
    example: 'intermediate',
    enum: ['beginner', 'intermediate', 'advanced'],
  })
  @IsOptional()
  @IsString()
  fitnessLevel?: string;

  @ApiPropertyOptional({
    description: 'User fitness goals',
    example: ['weightloss', 'strength'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];

  @ApiPropertyOptional({
    description: 'Desired workout duration in minutes',
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  duration?: number;
}
