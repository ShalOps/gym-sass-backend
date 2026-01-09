import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DateUtil } from '../common/utils/date.util';
import { User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
    private readonly db: DatabaseService,
  ) {}

  private async queueEmail(recipients: string[], subject: string, html: string) {
    try {
      await this.emailQueue.add(
        'send-email',
        {
          recipients,
          subject,
          html,
        },
        {
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
        },
      );
      this.logger.log(`Queued email to: ${recipients.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to queue email to ${recipients}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sends a notification for a new chat message
   */
  async notifyChatMessage(userId: number, senderName: string, content: string) {
    try {
      const user = await this.db.user.findUnique({
        where: { userId },
        select: { email: true, firstName: true },
      });

      if (!user) return;

      const subject = `New message from ${senderName} 💬`;
      const html = `
        <p>Hello ${user.firstName},</p>
        <p>You have a new message from <b>${senderName}</b>:</p>
        <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 10px 0;">
          ${content}
        </blockquote>
        <p>Log in to the platform to reply.</p>
        <p>Best regards,<br/>Fitness Platform Team</p>
      `;

      await this.queueEmail([user.email], subject, html);
    } catch (error) {
      this.logger.error(
        `Failed to send chat notification to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Sends a notification for a Telegram fallback message
   */
  async notifyTelegramFallback(userId: number, content: string) {
    try {
      const user = await this.db.user.findUnique({
        where: { userId },
        select: { email: true, firstName: true },
      });

      if (!user) return;

      const subject = 'Telegram Fallback Message 📱';
      const html = `
        <p>Hello ${user.firstName},</p>
        <p>A message was sent to you via Telegram fallback:</p>
        <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #666; margin: 10px 0;">
          ${content}
        </blockquote>
        <p>Best regards,<br/>Fitness Platform Team</p>
      `;

      await this.queueEmail([user.email], subject, html);
    } catch (error) {
      this.logger.error(
        `Failed to send telegram fallback notification to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Sends a notification for a broadcast message
   */
  async notifyBroadcast(userId: number, content: string) {
    try {
      const user = await this.db.user.findUnique({
        where: { userId },
        select: { email: true, firstName: true },
      });

      if (!user) return;

      const subject = 'Important Announcement 📢';
      const html = `
        <p>Hello ${user.firstName},</p>
        <p>We have an important announcement for you:</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #eee; margin: 10px 0;">
          ${content}
        </div>
        <p>Best regards,<br/>Fitness Platform Team</p>
      `;

      await this.queueEmail([user.email], subject, html);
    } catch (error) {
      this.logger.error(
        `Failed to send broadcast notification to user ${userId}:`,
        error,
      );
    }
  }

  async sendEmailReceipt(email: string, amount: Decimal, txRef: string) {
    const formattedAmount = amount.toFixed(2);
    const html = `
      <h1>Payment Receipt</h1>
      <p>Thank you for your payment of <b>${formattedAmount} ETB</b>.</p>
      <p>Your transaction reference is: <b>${txRef}</b></p>
      <p>We appreciate your business! 😊</p>
    `;
    const subject = `Payment Successful! 💳`;

    await this.queueEmail([email], subject, html);
  }

  async sendRefundPayment(email: string, refundAmount: number, txRef: string, reason: string) {
    const subject = `Refund Processed Successfully 💸`;
    const html = `
      <h2>Your Refund is Completed</h2>
      <p>Hello,</p>
      <p>We have successfully processed your refund.</p>
      <p><strong>Refund Amount:</strong> ${refundAmount} ETB</p>
      <p><strong>Transaction Reference:</strong> ${txRef}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you have any questions, feel free to contact us.</p>
      <br/>
      <p>Thank you,</p>
      <p><strong>Fitness Platform Team</strong></p>
    `;

    await this.queueEmail([email], subject, html);
  }


  async notifyUserBookingConfirmation(
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

    const html = `
      <h1>🎉 Congratulations, ${bookingDetails.userName}!</h1>
      <p>
        You have successfully booked <b>${bookingDetails.BookingName}</b> at
        <b>${formattedTime}</b> in <b>${bookingDetails.gymName} Gym</b>.
      </p>
      <p>We are excited to see you there! 💪</p>
    `;

    const subject = `Successfully Booked to ${bookingDetails.gymName} Gym, congratulations! 🎉`;

    await this.queueEmail([email], subject, html);
  }

  async notifyStaffClassBookingConfirmation(
    emails: string[],
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

    const subject = `New Class Booking for ${bookingDetails.gymName} Gym🏋️‍♂️`;

    if (emails[0]) {
      const htmlTrainer = `
        <h1>New Class Booking</h1>
        <p>The following class has been booked:</p>
        <ul>
          <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
          <li><b>User Name:</b> ${bookingDetails.userName}</li>
          <li><b>Start Time:</b> ${formattedTime}</li>
          <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
        </ul>
        <p>Please prepare accordingly.</p>
      `;
      await this.queueEmail([emails[0]], subject, htmlTrainer);
    }

    if (emails[1]) {
      const htmlOwner = `
        <h1>New Class Booking</h1>
        <p>The following class has been booked:</p>
        <ul>
          <li><b>
            Booking Name:</b> ${bookingDetails.BookingName}</li>
          <li><b>User Name:</b> ${bookingDetails.userName}</li>
          <li><b>Start Time:</b> ${formattedTime}</li>
          <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
        </ul>
        <p>Please ensure that your staff are informed and prepared accordingly.</p>
      `;
      await this.queueEmail([emails[1]], subject, htmlOwner);
    }
  }

  async notifyUserBookingCancellation(
    email: string,
    bookingDetails: {
      BookingName: string;
      userName: string;
      startTime: string;
      gymName: string;
      timezone: string;
    },
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      new Date(bookingDetails.startTime),
      bookingDetails.timezone,
    );

    const html = `
      <h1>Booking Cancellation Notice</h1>
      <p>Dear ${bookingDetails.userName},</p>
      <p>You have successfully canceled booking for <b>${bookingDetails.BookingName}</b> at <b>${formattedTime}</b> in <b>${bookingDetails.gymName} Gym</b> has been cancelled.</p>
      <p>If you have any questions or need further assistance, please contact us.</p>
      <p>You can rebook or explore other classes on our platform.</p>
    `;
    const subject = `Booking Cancellation Notice for ${bookingDetails.gymName} Gym😞`;

    await this.queueEmail([email], subject, html);
  }


  async notifyStaffClassBookingCancellation(
    emails: string[],
    bookingDetails: {
      BookingName: string;
      userName: string;
      startTime: string;
      gymName: string;
      timezone: string;
    },
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      new Date(bookingDetails.startTime),
      bookingDetails.timezone,
    );

    const subject = `Booking Cancellation Alert for ${bookingDetails.gymName} Gym⚠️`;

    if (emails[0]) {
      const htmlTrainer = `
        <h1>Booking Cancellation Alert</h1>
        <p>The following booking has been cancelled:</p>
        <ul>
          <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
          <li><b>User Name:</b> ${bookingDetails.userName}</li>
          <li><b>Start Time:</b> ${formattedTime}</li>
          <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
        </ul>
        <p>Please update your schedules accordingly.</p>
      `;
      await this.queueEmail([emails[0]], subject, htmlTrainer);
    }

    if (emails[1]) {
      const htmlOwner = `
        <h1>Booking Cancellation Alert</h1>
        <p>The following booking has been cancelled:</p>
        <ul>
          <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
          <li><b>User Name:</b> ${bookingDetails.userName}</li>
          <li><b>Start Time:</b> ${formattedTime}</li>
          <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
        </ul>
        <p>Please ensure that your staff are informed and schedules are updated accordingly.</p>
      `;
      await this.queueEmail([emails[1]], subject, htmlOwner);
    }
  }


  async notifyUserServiceBookingConfirmation(
    email: string,
    bookingDetails: {
      BookingName: string;
      startTime: Date;
      serviceName: string;
      duration: number;
      userName: string;
      timezone: string;
    }
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      bookingDetails.startTime,
      bookingDetails.timezone,
    );

    const html = `
      <h1>🎉 Congratulations, ${bookingDetails.userName}!</h1>
      <p>
        You have successfully booked <b>${bookingDetails.BookingName}</b> for <b>${bookingDetails.serviceName}</b> service at
        <b>${formattedTime}</b>. The duration of the service is <b>${bookingDetails.duration} minutes</b>.
      </p>
      <p>We are excited to serve you! 💪</p>
    `;

    const subject = `Successfully Booked ${bookingDetails.serviceName} Service, congratulations! 🎉`;

    await this.queueEmail([email], subject, html);
  }


  async notifyStaffServiceBookingConfirmation(
    email: string,
    bookingDetails: {
      BookingName: string;
      startTime: Date;
      serviceName: string;
      duration: number;
      userName: string;
      timezone: string;
    }
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      bookingDetails.startTime,
      bookingDetails.timezone,
    );

    const html = `<h1>New Service Booking</h1>
      <p>The following service has been booked:</p>
      <ul>
        <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
        <li><b>User Name:</b> ${bookingDetails.userName}</li>
        <li><b>Start Time:</b> ${formattedTime}</li>
        <li><b>Service Name:</b> ${bookingDetails.serviceName}</li>
        <li><b>Duration:</b> ${bookingDetails.duration} minutes</li>
      </ul>
      <p>Please prepare accordingly.</p>
      `;

    const subject = `New Service Booking for ${bookingDetails.serviceName} Service🏋️‍♂️`;

    await this.queueEmail([email], subject, html);
  }


  async notifyStaffServiceBookingCancellation(
    email: string,
    bookingDetails: {
      BookingName: string;
      userName: string;
      startTime: string;
      serviceName: string;
      timezone: string;
    }
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      new Date(bookingDetails.startTime),
      bookingDetails.timezone,
    );

    const html = `
      <h1>Booking Cancellation Alert</h1>
      <p>The following booking has been cancelled:</p>
      <ul>
        <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
        <li><b>User Name:</b> ${bookingDetails.userName}</li>
        <li><b>Start Time:</b> ${formattedTime}</li>
        <li><b>Service Name:</b> ${bookingDetails.serviceName}</li>
      </ul>
      <p>Please ensure that your staff are informed and schedules are updated accordingly.</p>
    `;
    const subject = `Booking Cancellation Alert for ${bookingDetails.serviceName} Service⚠️`;

    await this.queueEmail([email], subject, html);
  }

  async notifyAdmin(
    email: string,
    gymDetail: {
      gymId: number;
      gymName: string;
      ownerName: string;
      ownerEmail: string
    }
  ) {
    const html = `
      <h1>New Gym Created</h1>
      <p>A new gym has been created with the following details:</p>
      <ul>
        <li><b>Gym Name:</b> ${gymDetail.gymName}</li>
        <li><b>Owner Name:</b> ${gymDetail.ownerName}</li>
        <li><b>Owner Email:</b> ${gymDetail.ownerEmail}</li>
      </ul>
      <p>Please review the new gym details in the admin panel.</p>
    `;
    const subject = `New Gym Created: ${gymDetail.gymName} 🏋️‍♂️`;

    await this.queueEmail([email], subject, html);
  }

  async notifyUserPaymentFailed(
    user: User,
    paymentDetails: {
      amount: number;
      paymentDate: Date;
      paymentId: number;
      txRef: string;
    }

  ){
    const formattedDate = DateUtil.formatInTimezone(
      paymentDetails.paymentDate,
      'EAT',
    );

    const html = `
      <h1>Payment Failed Notification</h1>
      <p>Dear ${user.firstName},</p>
      <p>We regret to inform you that your recent payment attempt has failed.</p>
      <ul>
        <li><b>Amount:</b> ${paymentDetails.amount} ETB</li>
        <li><b>Payment Date:</b> ${formattedDate}</li>
        <li><b>Transaction Reference:</b> ${paymentDetails.txRef}</li>
      </ul>
      <p>Please try again or contact support if you need assistance.</p>
    `;
    const subject = `Payment Failed Notification 💳`;
    await this.queueEmail([user.email], subject, html);
  }


  async sendBookingReminder(
    email: string,
    details: { bookingName: string; startTime: Date },
  ) {
    const formatted = details.startTime.toISOString();

    const html = `
      <h1>Reminder: Upcoming Booking</h1>
      <p>You have an upcoming booking:</p>
      <ul>
        <li><b>Booking Name:</b> ${details.bookingName}</li>
        <li><b>Start Time:</b> ${formatted}</li>
      </ul>
      <p>See you soon!</p>
    `;
    const subject = `Reminder: Upcoming Booking for ${details.bookingName} ⏰`;

    await this.queueEmail([email], subject, html);
  }
}