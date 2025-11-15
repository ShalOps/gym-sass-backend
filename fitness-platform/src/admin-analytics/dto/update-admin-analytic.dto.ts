import { PartialType } from '@nestjs/swagger';
import { CreateAdminAnalyticDto } from './create-admin-analytic.dto';

export class UpdateAdminAnalyticDto extends PartialType(CreateAdminAnalyticDto) {}
