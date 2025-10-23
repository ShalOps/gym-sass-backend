import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from 'src/database/database.service'; 
  


@Injectable()
export class UsersService {
  constructor(private readonly databaseservice: DatabaseService){}

  async create(createUserDto: Prisma.UserCreateInput) {
    return this.databaseservice.user.create({
      data: createUserDto
    })
  }

  async findAll() {
    return this.databaseservice.user.findMany()
  }

  async findOne(id: number) {
    return this.databaseservice.user.findUnique({
      where: {
        userId: id,
      }
    })

  }

  async update(id: number, updateUserDto: Prisma.UserUpdateInput) {
    return this.databaseservice.user.update({
      where: {
        userId: id,
      },
      data: updateUserDto,
    })
  }

  async remove(id: number) {
    return this.databaseservice.user.delete({
      where: {
        userId: id,
      }
    })
  
  }
}
