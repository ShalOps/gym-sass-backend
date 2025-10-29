import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceOptionAssignmentDto } from './create-service-option-assignment.dto';

export class UpdateServiceOptionAssignmentDto extends PartialType(CreateServiceOptionAssignmentDto) {}
