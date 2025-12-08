import { Process, Processor } from '@nestjs/bull';
import { EmailService } from './email.service';
import { Logger } from '@nestjs/common';
import { sendEmailDto } from './dto/email.dto';
import type { Job } from 'bull';

@Processor('email-queue')
export class EmailConsumer {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('send-email')
  async handleSendEmail(job: Job<sendEmailDto>) {
    this.logger.log(`Processing email job ${job.id} for ${job.data.recipients}`);

    try {
      await this.emailService.sendEmail(job.data);
      this.logger.log(`Email job ${job.id} completed`);
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }
}