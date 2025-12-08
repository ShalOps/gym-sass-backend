import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | undefined;
  private readonly botUsername: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.botUsername = this.configService.get<string>('BOT_NAME');

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set - Telegram notifications will be disabled');
    }
  }

  async sendMessage(chatId: bigint, text: string) {
    
    if (!this.botToken) {
      this.logger.debug('Telegram bot token missing - skipping send');
      return;
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `https://api.telegram.org/bot${this.botToken}/sendMessage`,
          {
            chat_id: chatId,
            text,
          },
        ),
      );
      this.logger.verbose(`Telegram message sent to chat`);
    } catch (error: any) {
      
      this.logger.error('Failed to send Telegram message', error.response?.data || error.message);
    }
  }

  generateStartLink(userId: number): string {
    const payload = Buffer.from(userId.toString()).toString('base64url'); 
    return `https://t.me/${this.botUsername}?start=${payload}`;
  }

  async setWebhook(url: string) {
    if (!this.botToken) return;

    try {
      await firstValueFrom(
        this.httpService.post(
          `https://api.telegram.org/bot${this.botToken}/setWebhook`,
          { url },
        ),
      );
      this.logger.log(`Webhook successfully set to ${url}`);
    } catch (error: any) {
      this.logger.error(
        'Failed to set webhook',
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}
