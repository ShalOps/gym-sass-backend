import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';

export class UpdateReportStatusDto {
  @ApiProperty({
    enum: ReportStatus,
    description: 'The new status of the report',
    example: ReportStatus.RESOLVED,
  })
  @IsNotEmpty()
  @IsEnum(ReportStatus)
  status: ReportStatus;
}
