import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Runs daily at 2 AM to auto-complete past bookings
   * This prevents the performance issue of running this on every list request
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoCompletePastBookings() {
    try {
      this.logger.log('Starting auto-completion of past bookings...');

      const now = new Date();
      let classBookingsUpdated = 0;
      let serviceBookingsUpdated = 0;

      // Auto-complete class bookings
      const classResult = await this.databaseService.classBooking.updateMany({
        where: {
          status: BookingStatus.CONFIRMED,
          endTime: {
            lt: now,
          },
        },
        data: {
          status: BookingStatus.COMPLETED,
        },
      });
      classBookingsUpdated = classResult.count;

      // Auto-complete service bookings
      const serviceResult =
        await this.databaseService.serviceBooking.updateMany({
          where: {
            status: BookingStatus.CONFIRMED,
            endTime: {
              lt: now,
            },
          },
          data: {
            status: BookingStatus.COMPLETED,
          },
        });
      serviceBookingsUpdated = serviceResult.count;

      this.logger.log(
        `Auto-completed ${classBookingsUpdated} class bookings and ${serviceBookingsUpdated} service bookings`,
      );
    } catch (error) {
      this.logger.error('Failed to auto-complete past bookings', error);
    }
  }
}
