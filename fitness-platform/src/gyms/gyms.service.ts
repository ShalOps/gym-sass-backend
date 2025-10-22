import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from 'src/database/database.service'; 


@Injectable()
export class GymsService {
  constructor(private readonly databaseservice: DatabaseService){}

  create(createGymDto: Prisma.GymCreateInput) {
    return this.databaseservice.gym.create({
      data: createGymDto
    })
  }

  findAll() {
    return this.databaseservice.gym.findMany()

  }

  findOne(id: number) {
     return this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      }
    })

  }

  update(id: number, updateGymDto: Prisma.GymUpdateInput) {
      return this.databaseservice.gym.update({
      where: {
        gymId: id,
      },
      data: updateGymDto,
    })
  }

  remove(id: number) {
    return this.databaseservice.gym.delete({
      where: {
        gymId: id,
      }
    })
  }
}
