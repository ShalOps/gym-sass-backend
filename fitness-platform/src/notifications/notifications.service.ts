import { Injectable, Logger } from '@nestjs/common';
import { DateUtil } from '../common/utils/date.util';
import { EmailService } from 'src/email/email.service';
import { emoji } from 'zod/mini';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private readonly emailService:EmailService){}

  async sendEmailReceipt(email: string, amount: number, txRef: string) {

    const html = `
      <h1>Payment Receipt</h1>
      <p>Thank you for your payment of <b>${amount} ETB</b>.</p>
      <p>Your transaction reference is: <b>${txRef}</b></p>
      <p>We appreciate your business! 😊</p>
    `;

    const subject = `Payment Successful! 💳`;
    try {

      await this .emailService.sendEmail({
        recipients: [email],
        subject: subject,
        html: html,
      });

    } catch (error) {
      this.logger.error(`Failed to send payment receipt email to ${email}: ${error.message}`);
      throw error;
    }
  }

  async sendBookingConfirmation(
    email: string,
    bookingDetails: {
      BookingName: string;
      startTime: Date;
      gymName: string;
      userName: string;
      timezone: string;
    },
  ) {

    const formattedTime = DateUtil.formatInTimezone(
      bookingDetails.startTime,
      bookingDetails.timezone,
    );

        // wanted to mention user name
    const html = `
      <h1>🎉 Congratulations, ${bookingDetails.userName}!</h1>
      <p>
        You have successfully booked <b>${bookingDetails.BookingName}</b> at
        <b>${formattedTime}</b> in <b>${bookingDetails.gymName} Gym</b>.
      </p>
      <p>We are excited to see you there! 💪</p>
    `;

    const subject = `Successfully Booked to ${bookingDetails.gymName} Gym, congratulations! 🎉`;

    try {

      await this.emailService.sendEmail({
        recipients: [email],
        subject: subject,
        html: html,
      });

    } catch (error) {
      this.logger.error(`Failed to send booking confirmation email to ${email}: ${error.message}`);
      throw error;
    }
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

  async sendBookingReminder(
    email: string,
    details: { bookingName: string; startTime: Date },
  ) {
    // TODO: Integrate Email/SMS
    this.logger.log(
      `[MOCK REMINDER] Sending reminder to ${email} for "${details.bookingName}" at ${details.startTime.toISOString()}`,
    );
    return Promise.resolve();
  }
}
