import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGymsDto {
  @ApiProperty({
    description: 'Unique name of the gym',
    example: 'Powerhouse Fitness',
  })
  @IsString()
  gymName: string;

  @ApiPropertyOptional({
    description: 'Contact phone number of the gym',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  contactNo?: string;

  @ApiProperty({
    description: 'Physical location of the gym',
    example: 'GPS coordinates',
  })
  @IsString()
  location: string;

  @ApiPropertyOptional({
    description: 'Working hours of the gym',
    example: 'Mon-Fri: 6AM-10PM, Sat-Sun: 8AM-8PM',
  })
  @IsOptional()
  @IsString()
  workingHours?: string;

  @ApiPropertyOptional({
    description: 'Whether the gym is verified by admin',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  // @ApiProperty({
  //   description: 'ID of the gym owner (User with role GYMOWNER)',
  //   example: 5,
  // })
  // @IsInt()
  // gymOwnerId: number;
}

export class PaginationDto {
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsInt()
  @Min(1)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  workingHours?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsInt()
  gymOwnerId?: number;
}
