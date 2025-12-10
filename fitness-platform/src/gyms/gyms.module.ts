import { Module } from '@nestjs/common';
import { GymsService } from './gyms.service';
import { GymsController } from './gyms.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [DatabaseModule,NotificationModule],
  controllers: [GymsController],
  providers: [GymsService],
})
export class GymsModule {}
