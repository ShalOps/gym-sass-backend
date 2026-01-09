import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { Channel } from '@prisma/client';
import { AxiosResponse, AxiosError } from 'axios';
interface TelegramResponse {
  ok: boolean;
  description?: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string | undefined;
  private readonly botUsername: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    protected readonly databaseService: DatabaseService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.botUsername = this.configService.get<string>('BOT_NAME');

    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN is not set - Telegram notifications will be disabled',
      );
    }
  }

  async sendMessage(chatId: bigint, text: string, userId: number) {
    if (!this.botToken) {
      this.logger.debug('Telegram bot token missing - skipping send');
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response: AxiosResponse<TelegramResponse> = await firstValueFrom(
          this.httpService.post(
            `https://api.telegram.org/bot${this.botToken}/sendMessage`,
            {
              chat_id: chatId,
              text,
            },
          ),
        );
        if (response && response.data.ok === false) {
          throw new Error(
            response.data.description || 'Telegram API indicated failure.',
          );
        }
        this.logger.verbose(`Telegram message sent to chat`);
        break;
      } catch (error: unknown) {
        if (attempt === 3) {
          await this.databaseService.failedNotification.create({
            data: {
              userId: userId,
              channel: Channel.TELEGRAM,
              payload: `${text}`,
            },
          });

          let errorMessage = 'Unknown error';

          if (error instanceof AxiosError && error.response?.data) {
            errorMessage = JSON.stringify(error.response.data);
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          this.logger.error('Failed to send Telegram message', errorMessage);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  generateStartLink(userId: number): string {
    const payload = Buffer.from(userId.toString()).toString('base64url');
    return `https://t.me/${this.botUsername}?start=${payload}`;
  }

  async setWebhook(url: string) {
    if (!this.botToken) return;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!secretToken) {
      this.logger.error('TELEGRAM_WEBHOOK_SECRET is not set in .env');
      throw new Error('Missing webhook secret token');
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `https://api.telegram.org/bot${this.botToken}/setWebhook`,
          {
            url,
            secret_token: secretToken,
          },
        ),
      );
      this.logger.log(`Webhook successfully set to ${url}`);
    } catch (error: unknown) {
      let errorMessage = 'Unknown error';

      if (error instanceof AxiosError && error.response?.data) {
        errorMessage = JSON.stringify(error.response.data);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error('Failed to set webhook', errorMessage);
      throw error;
    }
  }
}
