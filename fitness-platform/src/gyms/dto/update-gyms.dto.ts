import { CreateGymsDto } from './create-gyms.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateGymsDto extends PartialType(CreateGymsDto) {}
