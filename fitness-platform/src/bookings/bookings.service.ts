import { DatabaseService } from '../database/database.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';

export abstract class BookingsService {
  protected constructor(protected readonly databaseService: DatabaseService) {}

  // Shared method to find all bookings for a user
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async findAll(_userId: number): Promise<any> {
    // This will be overridden in subclasses to specify the model
    throw new Error('findAll must be implemented in subclass');
  }

  // Shared method to find a booking by ID, with ownership check
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async findOne(_id: number, _userId: number): Promise<any> {
    // This will be overridden in subclasses
    throw new Error('findOne must be implemented in subclass');
  }

  // Shared method to update booking status or notes
  // eslint-disable-next-line @typescript-eslint/require-await
  async update(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _id: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updateData: {
      status?: BookingStatus;
      notes?: string;
      paymentStatus?: PaymentStatus;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: number,
  ): Promise<any> {
    // This will be overridden in subclasses
    throw new Error('update must be implemented in subclass');
  }

  // Shared method to cancel a booking
  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async cancel(_id: number, _userId: number): Promise<any> {
    // This will be overridden in subclasses
    throw new Error('cancel must be implemented in subclass');
  }

  // Helper method to check if user is admin or owner
  protected async checkOwnership(
    gymId: number,
    userId: number,
  ): Promise<boolean> {
    const user = await this.databaseService.user.findUnique({
      where: { userId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') return true;

    const gym = await this.databaseService.gym.findUnique({
      where: { gymId },
      select: { gymOwnerId: true },
    });

    return gym?.gymOwnerId === userId;
  }
}
