import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  Length,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateServiceBookingDto {
  @ApiProperty({
    description: 'ID of the service to book',
    example: 45,
  })
  @IsNumber()
  @IsNotEmpty()
  serviceId: number;

  @ApiPropertyOptional({
    description:
      'Requested start time for the service booking (ISO 8601 string)',
    example: '2025-11-20T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Requested end time for the service booking (ISO 8601 string)',
    example: '2025-11-20T15:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Optional notes by the user for this service booking',
    example: 'Prefers a morning slot if possible.',
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

  @ApiPropertyOptional({
    description: 'Optional add‑on option IDs for the service booking',
    example: [10, 12],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  optionIds?: number[];
}
