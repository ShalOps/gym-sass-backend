import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBootstrapService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService<{
      TELEGRAM_BOT_TOKEN: string;
      APP_URL: string;
    }>,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set → skipping webhook setup');
      return;
    }

    const appUrl = this.configService.get<string>('APP_URL');
    if (!appUrl) {
      this.logger.error('APP_URL is not set! Cannot set Telegram webhook.');
      return;
    }

    const webhookUrl = `${appUrl}/telegram/webhook`.replace(/\/+$/, '');

    try {
      await this.telegramService.setWebhook(webhookUrl);
      this.logger.log(`Telegram webhook set to: ${webhookUrl}`);
    } catch (error) {
      this.logger.error('Failed to set Telegram webhook', error);
    }
  }
}
