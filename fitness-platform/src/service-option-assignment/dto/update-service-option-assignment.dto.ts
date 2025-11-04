import { PartialType } from '@nestjs/swagger';
import { CreateServiceOptionAssignmentDto } from './create-service-option-assignment.dto';

export class UpdateServiceOptionAssignmentDto extends PartialType(CreateServiceOptionAssignmentDto) {}
