import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { GymsModule } from './gyms/gyms.module';
import { ServicesModule } from './services/services.module';
import { ServiceOptionModule } from './service-option/service-option.module';
import { GymClassesModule } from './gym-classes/gym-classes.module';

@Module({
  imports: [DatabaseModule, UsersModule, GymsModule, ServicesModule, ServiceOptionModule, GymClassesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
