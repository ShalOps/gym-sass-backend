import { Module } from '@nestjs/common';
import { TrainerController } from './trainers.controller';
import { TrainerService } from './trainers.service';
import { DatabaseService } from 'src/database/database.service';


@Module({
  controllers: [TrainerController],
  providers: [TrainerService, DatabaseService],
})
export class TrainerModule {}
