import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TelegramBootstrapService } from './telegram-bootstrap.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBootstrapService],
  exports: [TelegramService],
})
export class TelegramModule {}
