import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MuteConversationDto {
  @ApiProperty({
    example: true,
    description: 'Whether to mute the conversation',
  })
  @IsBoolean()
  isMuted: boolean;
}
