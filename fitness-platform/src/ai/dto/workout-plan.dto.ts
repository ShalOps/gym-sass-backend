import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  Min,
  Max,
  ArrayMaxSize,
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
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';

  @ApiPropertyOptional({
    description: 'User fitness goals',
    example: ['weightloss', 'strength'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  goals?: string[];

  @ApiPropertyOptional({
    description: 'Desired workout duration in minutes',
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(180)
  duration?: number;
}
