import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmailReceipt(email: string, amount: number, txRef: string) {
    // TODO: Integrate Nodemailer/SMS
    this.logger.log(
      `[MOCK EMAIL] Sending receipt to ${email} for ${amount} ETB (Ref: ${txRef})`,
    );
  }

  async notifyUser(userId: number, message: string) {
    // TODO: Integrate SMS/Telegram/In-app notification
    this.logger.log(`[MOCK NOTIFICATION] User ${userId}: ${message}`);
  }

  async notifyAdmin(message: string) {
    // TODO: Integrate Slack/Telegram for admin alerts
    this.logger.log(`[MOCK ADMIN ALERT] ${message}`);
  }
}
