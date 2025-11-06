import { CreateServiceDto } from './create-services.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
