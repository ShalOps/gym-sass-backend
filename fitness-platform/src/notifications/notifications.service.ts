import { Injectable, Logger } from '@nestjs/common';
import { DateUtil } from '../common/utils/date.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmailReceipt(email: string, amount: number, txRef: string) {
    // TODO: Integrate Nodemailer/SMS
    this.logger.log(
      `[MOCK EMAIL] Sending receipt to ${email} for ${amount} ETB (Ref: ${txRef})`,
    );
  }

  async sendBookingConfirmation(
    email: string,
    bookingDetails: {
      BookingName: string;
      startTime: Date;
      gymName: string;
      timezone: string;
    },
  ) {
    // TODO: Integrate in Both Booking Services
    const formattedTime = DateUtil.formatInTimezone(
      bookingDetails.startTime,
      bookingDetails.timezone,
    );

    this.logger.log(
      `[MOCK EMAIL] Sending booking confirmation to ${email} for "${bookingDetails.BookingName}" at ${formattedTime} (${bookingDetails.gymName})`,
    );
  }

  async notifyUser(userId: number, message: string) {
    // TODO: Integrate SMS/Telegram/In-app notification
    this.logger.log(`[MOCK NOTIFICATION] User ${userId}: ${message}`);
  }

  async notifyStaff(email: string, message: string) {
    // TODO: Integrate Email/SMS for staff (Trainers/Owners)
    this.logger.log(`[MOCK STAFF NOTIFICATION] To ${email}: ${message}`);
  }

  async notifyAdmin(message: string) {
    // TODO: Integrate Slack/Telegram for admin alerts
    this.logger.log(`[MOCK ADMIN ALERT] ${message}`);
  }
}
