import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  Length,
} from 'class-validator';

export class CreateClassBookingDto {
  @ApiProperty({
    description: 'ID of the class to book',
    example: 123,
  })
  @IsNumber()
  @IsNotEmpty()
  classId: number;

  @ApiPropertyOptional({
    description: 'Requested start time for the class booking (ISO 8601 string)',
    example: '2025-11-15T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Requested end time for the class booking (ISO 8601 string)',
    example: '2025-11-15T11:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Optional notes by the user for this class booking',
    example: 'I’d like a front‑row spot, please.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Payment intent ID if already created',
    example: 'pi_1GqICZ2eZvKYlo2ChXrlK9Qb',
  })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;
}
