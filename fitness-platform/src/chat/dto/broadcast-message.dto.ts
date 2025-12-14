import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class BroadcastMessageDto {
  @ApiProperty({
    example: 'System maintenance at midnight',
    description: 'Content of the broadcast message',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    enum: Role,
    required: true,
    description: 'Target role for the broadcast (required)',
  })
  @IsEnum(Role)
  targetRole: Role;
}
