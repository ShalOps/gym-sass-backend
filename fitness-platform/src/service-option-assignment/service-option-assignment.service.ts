import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceOptionAssignmentDto } from './dto/create-service-option-assignment.dto';
import { UpdateServiceOptionAssignmentDto } from './dto/update-service-option-assignment.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ServiceOptionAssignmentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    createServiceOptionAssignmentDto: CreateServiceOptionAssignmentDto,
    currentUserId: number,
  ) {
    const gym = await this.databaseService.gym.findUnique({
      where: {
        gymId: createServiceOptionAssignmentDto.gymId,
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(
        `Gym with ID ${createServiceOptionAssignmentDto.gymId} not found`,
      );
    }

    const service = await this.databaseService.service.findUnique({
      where: {
        serviceId: createServiceOptionAssignmentDto.serviceId,
      },
      select: {
        gymId: true,
      },
    });

    if (!service) {
      throw new NotFoundException(
        `Service with id ${createServiceOptionAssignmentDto.serviceId} not found`,
      );
    }

    const option = await this.databaseService.serviceOption.findUnique({
      where: {
        optionId: createServiceOptionAssignmentDto.optionId,
      },
      select: {
        gymId: true,
      },
    });

    if (!option) {
      throw new NotFoundException(
        `Service option with id ${createServiceOptionAssignmentDto.optionId} not found`,
      );
    }

    if (service?.gymId !== option?.gymId) {
      throw new ForbiddenException(
        `Servive and Service option must be member of the same gym`,
      );
    }

    const ownerOrAdmin = await this.databaseService.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (ownerOrAdmin?.role !== 'ADMIN') {
      if (gym?.gymOwnerId !== currentUserId) {
        throw new ForbiddenException(
          `Cannot create a service option assignment for a gym you do not own`,
        );
      }
    }

    return this.databaseService.serviceOptionAssignment.create({
      data: createServiceOptionAssignmentDto,
    });
  }

  async findAll() {
    return this.databaseService.serviceOptionAssignment.findMany();
  }

  async findOne(id: number) {
    const serviceOptionAssignment =
      await this.databaseService.serviceOptionAssignment.findUnique({
        where: {
          optionAssignmentId: id,
        },
      });

    if (!serviceOptionAssignment) {
      throw new NotFoundException(
        `Service option assignment with id ${id} not found `,
      );
    }

    return serviceOptionAssignment;
  }

  async update(
    id: number,
    updateServiceOptionAssignmentDto: UpdateServiceOptionAssignmentDto,
    currentUserId: number,
  ) {
    let gym: { gymId: number; gymOwnerId: number } | null = null;

    if (updateServiceOptionAssignmentDto.gymId) {
      gym = await this.databaseService.gym.findUnique({
        where: {
          gymId: updateServiceOptionAssignmentDto.gymId,
        },
        select: {
          gymId: true,
          gymOwnerId: true,
        },
      });
    } else {
      const result =
        await this.databaseService.serviceOptionAssignment.findUnique({
          where: {
            optionAssignmentId: id,
          },
          select: {
            gym: {
              select: {
                gymId: true,
                gymOwnerId: true,
              },
            },
          },
        });
      gym = result?.gym ?? null;
    }

    const serviceOptionAssignment =
      await this.databaseService.serviceOptionAssignment.findUnique({
        where: {
          optionAssignmentId: id,
        },
      });

    if (!serviceOptionAssignment) {
      throw new NotFoundException(
        `Service option assignment with id ${id} not found `,
      );
    }

    const ownerOrAdmin = await this.databaseService.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (ownerOrAdmin?.role !== 'ADMIN') {
      if (gym?.gymOwnerId !== currentUserId) {
        throw new ForbiddenException(
          `Cannot update service option assignment you do not own`,
        );
      }
    }

    return this.databaseService.serviceOptionAssignment.update({
      where: {
        optionAssignmentId: id,
      },
      data: updateServiceOptionAssignmentDto,
    });
  }

  async remove(id: number, currentUserId: number) {
    const serviceOptionAssignment =
      await this.databaseService.serviceOptionAssignment.findUnique({
        where: {
          optionAssignmentId: id,
        },
        select: {
          gym: {
            select: {
              gymId: true,
              gymOwnerId: true,
            },
          },
        },
      });

    const ownerOrAdmin = await this.databaseService.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (ownerOrAdmin?.role !== 'ADMIN') {
      if (serviceOptionAssignment?.gym.gymOwnerId !== currentUserId) {
        throw new ForbiddenException(
          `Cannot delete a service option assignment you do not own`,
        );
      }
    }

    if (!serviceOptionAssignment) {
      throw new NotFoundException(
        `Service option assignment with id ${id} not found `,
      );
    }

    await this.databaseService.serviceOptionAssignment.delete({
      where: {
        optionAssignmentId: id,
      },
    });
  }
}
