import { CreateServiceOptionDto } from './create-service-option.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateServiceOptionDto extends PartialType(
  CreateServiceOptionDto,
) {}
