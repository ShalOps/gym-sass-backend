import { Injectable, Logger } from '@nestjs/common';
import { DateUtil } from '../common/utils/date.util';
import { EmailService } from 'src/email/email.service';


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

  async sendRefundPayment(email: string,refundAmount: number,txRef: string,reason: string,) {

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

      try{
        return this.emailService.sendEmail({
        recipients: [email],
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send payment receipt email to ${email}: ${error.message}`);
      throw error;
    }
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

  async notifyStaffBookingConfirmation(
    email: string[],
    bookingDetails: {
      BookingName: string;
      startTime: Date;
      gymName: string;
      userName: string;
      timezone: string;
    }
  ) {

    const formattedTime = DateUtil.formatInTimezone(
      bookingDetails.startTime,
      bookingDetails.timezone,
    );

    const htmlTrainer = `
      <h1>New Booking Alert!</h1>
      <p>The following booking has been made:</p>
      <ul>
        <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
        <li><b>User Name:</b> ${bookingDetails.userName}</li>
        <li><b>Start Time:</b> ${formattedTime}</li>
        <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
      </ul>
      <p>Please prepare accordingly.</p>
    `;
    const htmlOwner = `
      <h1>New Booking Alert!</h1>
      <p>The following booking has been made:</p>
      <ul>
        <li><b>Booking Name:</b> ${bookingDetails.BookingName}</li>
        <li><b>User Name:</b> ${bookingDetails.userName}</li>
        <li><b>Start Time:</b> ${formattedTime}</li>
        <li><b>Gym Name:</b> ${bookingDetails.gymName} Gym</li>
      </ul>
      <p>Please ensure that your staff are informed and prepared accordingly.</p>
    `;
    const subject = `New Booking Alert for ${bookingDetails.gymName} Gym! 📢`;

    try {
      this.emailService.sendEmail({
        recipients: [email[0]],
        subject: subject,
        html: htmlTrainer,
      })
      this.emailService.sendEmail({
        recipients: [email[1]],
        subject: subject,
        html: htmlOwner,
      });
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation email to staff at ${email}: ${error.message}`);
      throw new Error(`Failed to send booking confirmation email to staff at ${email}`);
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
  }) {
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

    try {

      await this.emailService.sendEmail({
        recipients: [email],
        subject: subject,
        html: html,
      });

    } catch (error) {
      this.logger.error(`Failed to send booking cancellation email to ${email}: ${error.message}`);
      throw error;
    }
  }


  async notifyStaffClassBookingCancellation(
    email: string[],
    bookingDetails: {
      BookingName: string;
      userName: string;
      startTime: string;
      gymName: string;
      timezone: string;
    }
  ) {
    const formattedTime = DateUtil.formatInTimezone(
      new Date(bookingDetails.startTime),
      bookingDetails.timezone,
    );

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
    const subject = `Booking Cancellation Alert for ${bookingDetails.gymName} Gym⚠️`;

    try {
      this.emailService.sendEmail({
        recipients: [email[0]],
        subject: subject,
        html: htmlTrainer,
      })
      this.emailService.sendEmail({
        recipients: [email[1]],
        subject: subject,
        html: htmlOwner,
      });
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation email to staff at ${email}: ${error.message}`);
      throw new Error(`Failed to send booking cancellation email to staff at ${email}`);
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
  ){
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
    try {
      await this.emailService.sendEmail({
        recipients: [email],
        subject: subject,
        html: html,
      });
    } catch (error) {
      this.logger.error(`Failed to send service booking confirmation email to ${email}: ${error.message}`);
      throw new Error(`Failed to send service booking confirmation email to ${email}`);
    }

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
    try {

      this.emailService.sendEmail({
        recipients: [email[1]],
        subject: subject,
        html: html,
      });

    } catch (error) {
      this.logger.error(`Failed to send booking cancellation email to staff at ${email}: ${error.message}`);
      throw new Error(`Failed to send booking cancellation email to staff at ${email}`);
    }


  }


  async notifyUser(userId: number, message: string) {
    // TODO: Integrate SMS/Telegram/In-app notification
    this.logger.log(`[MOCK NOTIFICATION] User ${userId}: ${message}`);
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
