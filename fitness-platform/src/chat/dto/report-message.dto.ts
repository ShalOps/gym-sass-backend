import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportMessageDto {
  @ApiProperty({
    example: 'Inappropriate content',
    description: 'Reason for reporting the message',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
