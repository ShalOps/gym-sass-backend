import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BookingsService } from './bookings.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ClassBookingsService extends BookingsService {
  constructor(protected readonly databaseService: DatabaseService) {
    super(databaseService);
  }

  async findAll(
    userId: number,
    filters?: {
      status?: BookingStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    // Auto-complete past bookings before returning results
    await this.autoCompletePastBookings();

    const where: {
      userId: number;
      status?: BookingStatus;
      bookedAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = { userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.bookedAt = {};
      if (filters.startDate) {
        where.bookedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.bookedAt.lte = filters.endDate;
      }
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    return this.databaseService.classBooking.findMany({
      where,
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
      orderBy: { bookedAt: 'desc' },
      skip,
      take: limit,
    });
  }

  async findOne(id: number, userId: number) {
    const booking = await this.databaseService.classBooking.findUnique({
      where: { classBookingId: id },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Class booking not found');
    }

    // Check if user owns the booking or is admin/gym owner
    if (booking.userId !== userId) {
      const isOwner = await this.checkOwnership(booking.class.gymId, userId);
      if (!isOwner) {
        throw new ForbiddenException(
          'You do not have permission to view this booking',
        );
      }
    }

    return booking;
  }

  async update(
    id: number,
    updateData: {
      status?: BookingStatus;
      notes?: string;
      paymentStatus?: PaymentStatus;
    },
    userId: number,
  ) {
    // First, find the booking to check ownership
    const booking = await this.findOne(id, userId);

    // Business logic: can't update status to certain values if already completed
    if (booking.status === BookingStatus.COMPLETED && updateData.status) {
      throw new BadRequestException(
        'Cannot update status of a completed booking',
      );
    }

    // Update the booking
    return this.databaseService.classBooking.update({
      where: { classBookingId: id },
      data: updateData,
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
    });
  }

  async cancel(id: number, userId: number) {
    // First, find the booking to check ownership
    const booking = await this.findOne(id, userId);

    // Business logic: can't cancel if already completed or cancelled
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot cancel a completed or already cancelled booking',
      );
    }

    // Update status to cancelled
    return this.databaseService.classBooking.update({
      where: { classBookingId: id },
      data: { status: BookingStatus.CANCELLED },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
    });
  }

  async create(
    userId: number,
    classId: number,
    startTime?: Date,
    endTime?: Date,
    notes?: string,
  ) {
    // Check if class exists and get capacity
    const gymClass = await this.databaseService.gymClasses.findUnique({
      where: { classId },
      include: { gym: true },
    });

    if (!gymClass) {
      throw new NotFoundException('Gym class not found');
    }

    // Check capacity: count current confirmed bookings for this class at this time
    // For simplicity, assume no time overlap check yet, just total capacity
    const confirmedBookings = await this.databaseService.classBooking.count({
      where: {
        classId,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (confirmedBookings >= gymClass.capacity) {
      throw new BadRequestException('Class is at full capacity');
    }

    // Create the booking
    return this.databaseService.classBooking.create({
      data: {
        userId,
        classId,
        startTime,
        endTime,
        notes,
      },
      include: {
        class: {
          include: {
            gym: true,
            trainer: true,
          },
        },
      },
    });
  }
}
