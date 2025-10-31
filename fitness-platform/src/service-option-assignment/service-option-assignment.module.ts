import { Module } from '@nestjs/common';
import { ServiceOptionAssignmentService } from './service-option-assignment.service';
import { ServiceOptionAssignmentController } from './service-option-assignment.controller';

@Module({
  controllers: [ServiceOptionAssignmentController],
  providers: [ServiceOptionAssignmentService],
})
export class ServiceOptionAssignmentModule {}
