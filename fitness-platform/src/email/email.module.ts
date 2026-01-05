import { Module } from '@nestjs/common';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailConsumer } from './email.consumer';

@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [EmailService, EmailConsumer],
})
export class EmailModule {}
