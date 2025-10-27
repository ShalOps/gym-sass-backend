import { Injectable,NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateUsersDto } from './dto/update-users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async findAll(pagination: PaginationDto) {
    const { page, limit, search, location, gender, goal, role } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
      ];
    }
    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive' as const,
      };
    }
    if (gender) where.gender = gender;
    if (goal) where.goal = goal;
    if (role) where.role = role;
    const [data, total] = await Promise.all([
      this.databaseservice.user.findMany({
        where,
        skip,
        take: limit,
      }),
      this.databaseservice.user.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {

    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
      select: {
        userId: true
      }
    })

    if(!user){
      throw new NotFoundException(`User with ID ${id} id not found`)
    }

    return this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
    });
  }

  async update(id: number, updateUsersDto: UpdateUsersDto) {

    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
      select: {
        userId: true
      }
    })

    if(!user){
      throw new NotFoundException(`User with ID ${id} id not found`)
    }
    
    return this.databaseservice.user.update({
      where: {
        userId: id,
      },
      data: updateUsersDto,
    });
  }

  async remove(id: number) {

    const user = await this.databaseservice.user.findUnique({
      where: {
        userId: id,
      },
      select: {
        userId: true
      }
    })

    if(!user){
      throw new NotFoundException(`User with ID ${id} id not found`)
    }


    await this.databaseservice.user.delete({
      where: {
        userId: id,
      },
    });
  }
}