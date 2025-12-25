import { Module } from '@nestjs/common';
import { TrainerController } from './trainers.controller';
import { TrainerService } from './trainers.service';
import { DatabaseService } from 'src/database/database.service';
import { DatabaseModule } from 'src/database/database.module';


@Module({
  imports: [DatabaseModule],
  controllers: [TrainerController],
  providers: [TrainerService, DatabaseService],
})

export class TrainerModule {}
