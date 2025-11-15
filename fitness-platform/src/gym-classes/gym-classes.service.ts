import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateGymClassesDto } from './dto/create-gym-classes.dto';
import { UpdateGymClassesDto } from './dto/update-gym-classes.dto';

@Injectable()
export class GymClassesService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async create(
    createGymClassesDto: CreateGymClassesDto,
    currentUserId: number,
  ) {
    const gym = await this.databaseservice.gym.findUnique({
      where: {
        gymId: createGymClassesDto.gymId,
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    });

    if (!gym) {
      throw new NotFoundException(
        `Gym with ID ${createGymClassesDto.gymId} not found`,
      );
    }

    const trainer = await this.databaseservice.user.findUnique({
      where: {
        userId: createGymClassesDto.trainerId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (!trainer) {
      throw new NotFoundException(
        `User with ID ${createGymClassesDto.trainerId} not found`,
      );
    }
    if (trainer.role !== 'TRAINER') {
      throw new ForbiddenException(
        `User with ID ${createGymClassesDto.trainerId} is not a trainer`,
      );
    }

    const ownerOrAdmin = await this.databaseservice.user.findUnique({
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
          'Cannot create class for gym you do not own',
        );
      }
    }

    return this.databaseservice.gymClasses.create({
      data: createGymClassesDto,
    });
  }

  async findAll() {
    const classes = await this.databaseservice.gymClasses.findMany({
      include: {
        gym: true,
        trainer: true,
        coverPhoto: {
          select: {
            thumbnailUrl: true,
          },
        },
      },
    });

    return classes.map((gymClass) => ({
      ...gymClass,
      coverPhotoUrl: gymClass.coverPhoto?.thumbnailUrl || null,
    }));
  }

  async findOne(id: number) {
    const gymClass = await this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id,
      },
      include: {
        gym: true,
        trainer: true,
        coverPhoto: {
          select: {
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!gymClass) {
      throw new NotFoundException(`Gym class with ID ${id} not found`);
    }

    return {
      ...gymClass,
      coverPhotoUrl: gymClass.coverPhoto?.thumbnailUrl || null,
    };
  }

  async update(
    id: number,
    updateGymClassesDto: UpdateGymClassesDto,
    currentUserId: number,
  ) {
    let gym: { gymId: number; gymOwnerId: number } | null = null;

    if (updateGymClassesDto.gymId) {
      gym = await this.databaseservice.gym.findUnique({
        where: {
          gymId: updateGymClassesDto.gymId,
        },
        select: {
          gymId: true,
          gymOwnerId: true,
        },
      });

      if (!gym) {
        throw new NotFoundException(
          `Gym with ID ${updateGymClassesDto.gymId} not found`,
        );
      }
    } else {
      const result = await this.databaseservice.gymClasses.findUnique({
        where: {
          classId: id,
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

    if (updateGymClassesDto.trainerId) {
      const trainer = await this.databaseservice.user.findUnique({
        where: {
          userId: updateGymClassesDto.trainerId,
        },
        select: {
          userId: true,
          role: true,
        },
      });

      if (!trainer) {
        throw new NotFoundException(
          `User with ID ${updateGymClassesDto.trainerId} not found`,
        );
      }
      if (trainer.role !== 'TRAINER') {
        throw new ForbiddenException(
          `User with ID ${updateGymClassesDto.trainerId} is not a trainer`,
        );
      }
    }

    const gymClass = await this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id,
      },
    });

    if (!gymClass) {
      throw new NotFoundException(`Gym class with ID ${id} not found`);
    }

    const ownerOrAdmin = await this.databaseservice.user.findUnique({
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
        throw new ForbiddenException(`Cannot update gym you do not own`);
      }
    }

    return this.databaseservice.gymClasses.update({
      where: {
        classId: id,
      },
      data: updateGymClassesDto,
    });
  }

  async remove(id: number, currentUserId: number) {
    const gymClass = await this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id,
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

    if (!gymClass) {
      throw new NotFoundException(`Gym class with ID ${id} not found`);
    }

    const ownerOrAdmin = await this.databaseservice.user.findUnique({
      where: {
        userId: currentUserId,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (ownerOrAdmin?.role !== 'ADMIN') {
      if (gymClass?.gym.gymOwnerId !== currentUserId) {
        throw new ForbiddenException(`Cannot delete a gym you do not own`);
      }
    }

    await this.databaseservice.gymClasses.delete({
      where: {
        classId: id,
      },
    });
  }
}