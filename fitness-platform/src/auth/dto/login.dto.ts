import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  
  @ApiPropertyOptional({
      description: 'User email address',
      example: 'johndoe@example.com',
      format: 'email',
    })
  @IsOptional() 
  @IsEmail() 
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional() 
  @IsString()
  phoneNo?: string;

  @ApiProperty({
    description: 'Password (will be hashed)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsNotEmpty() 
  @IsString()
  password: string;
}
