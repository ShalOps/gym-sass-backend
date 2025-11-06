import { Module } from '@nestjs/common';
import { ServiceOptionService } from './service-option.service';
import { ServiceOptionController } from './service-option.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceOptionController],
  providers: [ServiceOptionService],
})
export class ServiceOptionModule {}
