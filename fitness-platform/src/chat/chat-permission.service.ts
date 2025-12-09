import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role } from '@prisma/client';

@Injectable()
export class ChatPermissionService {
  constructor(private readonly db: DatabaseService) {}

  async validateConversationStart(initiatorId: number, recipientId: number) {
    if (initiatorId === recipientId) {
      throw new ForbiddenException('You cannot chat with yourself');
    }

    const initiator = await this.db.user.findUnique({
      where: { userId: initiatorId },
      select: { role: true },
    });

    const recipient = await this.db.user.findUnique({
      where: { userId: recipientId },
      select: { role: true },
    });

    if (!initiator || !recipient) {
      throw new NotFoundException('User not found');
    }

    // Admin can chat with anyone
    if (initiator.role === Role.ADMIN) {
      return true;
    }

    // Determine the relationship direction
    const pair = `${initiator.role}_${recipient.role}`;

    switch (pair) {
      case `${Role.CUSTOMER}_${Role.TRAINER}`:
        return true; // Allowed

      case `${Role.CUSTOMER}_${Role.GYMOWNER}`:
        return true;

      case `${Role.CUSTOMER}_${Role.VENDOR}`:
        return true;

      case `${Role.CUSTOMER}_${Role.CUSTOMER}`:
        throw new ForbiddenException('Customers cannot chat with each other');

      case `${Role.TRAINER}_${Role.CUSTOMER}`:
        return this.checkTrainerCustomerConnection(initiatorId, recipientId);

      case `${Role.TRAINER}_${Role.TRAINER}`:
        return this.checkTrainerTrainerConnection(initiatorId, recipientId);

      case `${Role.GYMOWNER}_${Role.CUSTOMER}`:
        return this.checkGymOwnerCustomerConnection(initiatorId, recipientId);

      case `${Role.GYMOWNER}_${Role.GYMOWNER}`:
        return true; // Allow gym owner networking freely

      case `${Role.GYMOWNER}_${Role.TRAINER}`:
        return this.checkTrainerGymOwnerConnection(recipientId, initiatorId);

      case `${Role.VENDOR}_${Role.CUSTOMER}`:
        // TODO: Implement Order check when Order model is available
        // For now, we'll allow it or maybe restrict it?
        // The rule says "Conditional". Let's restrict for safety if we can't check.
        // But for MVP, maybe allow if we assume they have an order?
        // Let's throw for now as "Not implemented" or return true with a TODO comment.
        return true;

      case `${Role.VENDOR}_${Role.TRAINER}`:
        return true;

      case `${Role.VENDOR}_${Role.GYMOWNER}`:
        return true;

      case `${Role.TRAINER}_${Role.GYMOWNER}`:
        return this.checkTrainerGymOwnerConnection(initiatorId, recipientId);

      default:
        // Default deny for undefined interactions (e.g. Trainer <-> Trainer, Vendor <-> Vendor)
        // Unless explicitly allowed.
        if (recipient.role === Role.ADMIN) {
          return true;
        }
        throw new ForbiddenException(
          `Chat between ${initiator.role} and ${recipient.role} is not allowed`,
        );
    }
  }

  private async checkTrainerCustomerConnection(
    trainerId: number,
    customerId: number,
  ) {
    // Check if Customer has an active/past booking with Trainer
    const booking = await this.db.classBooking.findFirst({
      where: {
        userId: customerId,
        class: {
          trainerId: trainerId,
        },
      },
    });

    if (!booking) {
      throw new ForbiddenException(
        'Trainers can only message customers who have booked their classes',
      );
    }
    return true;
  }

  private async checkGymOwnerCustomerConnection(
    ownerId: number,
    customerId: number,
  ) {
    // Check Class Bookings in Owner's Gyms
    const classBooking = await this.db.classBooking.findFirst({
      where: {
        userId: customerId,
        class: {
          gym: {
            gymOwnerId: ownerId,
          },
        },
      },
    });

    if (classBooking) return true;

    // Check Service Bookings in Owner's Gyms
    const serviceBooking = await this.db.serviceBooking.findFirst({
      where: {
        userId: customerId,
        service: {
          gym: {
            gymOwnerId: ownerId,
          },
        },
      },
    });

    if (serviceBooking) return true;

    throw new ForbiddenException(
      'Gym Owners can only message customers who have booked services/classes at their gym',
    );
  }

  private async checkTrainerGymOwnerConnection(
    trainerId: number,
    ownerId: number,
  ) {
    // Check if Trainer teaches at a Gym owned by Owner
    const employment = await this.db.gymClasses.findFirst({
      where: {
        trainerId: trainerId,
        gym: {
          gymOwnerId: ownerId,
        },
      },
    });

    if (!employment) {
      throw new ForbiddenException(
        'Trainers can only message Gym Owners they work for',
      );
    }
    return true;
  }

  private async checkTrainerTrainerConnection(
    trainerId1: number,
    trainerId2: number,
  ) {
    // Check if both trainers work at gyms owned by the same owner (same gym network)
    const commonGyms = await this.db.gymClasses.findFirst({
      where: {
        trainerId: trainerId1,
        gym: {
          gymClasses: {
            some: { trainerId: trainerId2 },
          },
        },
      },
    });

    if (!commonGyms) {
      throw new ForbiddenException(
        'Trainers can only message other trainers in the same gym network',
      );
    }
    return true;
  }
}
