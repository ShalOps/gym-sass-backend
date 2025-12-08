import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DateUtil } from '../common/utils/date.util';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('email-queue') private readonly emailQueue: Queue
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

  async sendEmailReceipt(email: string, amount: number, txRef: string) {
    const html = `
      <h1>Payment Receipt</h1>
      <p>Thank you for your payment of <b>${amount} ETB</b>.</p>
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