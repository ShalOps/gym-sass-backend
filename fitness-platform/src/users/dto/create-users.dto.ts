import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean
} from 'class-validator';
import { Gender, Goal, Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUsersDto {
  @ApiProperty({
    description: 'First name of the user',
    example: 'John',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: 'Last name of the user',
    example: 'Doe',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Unique username for login',
    example: 'johndoe123',
  })
  @IsString()
  @IsString()
  userName: string;

  @ApiProperty({
    description: 'Password (will be hashed)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  password: string;

  @ApiProperty({
    description: 'Birth date in ISO format (YYYY-MM-DD)',
    example: '1990-05-15',
  })
  @IsDateString()
  birthDate: string;

  @ApiProperty({
    description: 'Gender of the user',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'johndoe@example.com',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phoneNo?: string;

  @ApiPropertyOptional({
    description: 'URL to profile picture',
    example: '/profiles/john.jpg',
  })
  @IsOptional()
  @IsString()
  profilePic?: string;

  @ApiPropertyOptional({
    description: 'Short bio or description',
    example: 'Fitness enthusiast ',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'User location at the given time ',
    example: 'GPS Coordinates',
  })
  @IsString()
  location: string;

  @ApiPropertyOptional({
    description: 'Fitness goal',
    enum: Goal,
    example: Goal.WEIGHTLOSS,
  })
  @IsOptional()
  @IsEnum(Goal)
  goal?: Goal;

  @ApiPropertyOptional({
    description: 'User role (defaults to CUSTOMER)',
    enum: Role,
    example: Role.CUSTOMER,
    default: Role.CUSTOMER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Whether the user is a vendor',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVendor?: boolean;
}
