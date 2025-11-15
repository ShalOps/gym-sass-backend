import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { PaginationDto } from './dto/pagination.dto';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';

@Injectable()
export class GymsService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async create(createGymsDto: CreateGymsDto, currentUserId: number) {

    const gymOwner = await this.databaseservice.user.findUnique({
          where: { 
            userId: currentUserId
           },
          select:
           {
             userId: true, 
             role: true 
            },
        });
    
        if (!gymOwner) {
          throw new NotFoundException(`User with ID ${currentUserId} not found`);
        }
        if (gymOwner.role !== 'GYMOWNER') {
          throw new ForbiddenException(`User with ID ${currentUserId} is not a Gym owner`);
        }
    
    return this.databaseservice.gym.create({
      data: { ...createGymsDto,
         gymOwnerId: currentUserId
        }
    });
  }

  async findAll(pagination: PaginationDto) {
    const {
      page,
      limit,
      search,
      location,
      workingHours,
      verified,
      gymOwnerId,
    } = pagination;
    const skip = (page - 1) * limit;
    const where: Prisma.GymWhereInput = {};
    if (search)
      where.gymName = {
        contains: search,
        mode: 'insensitive' as const,
      };
    if (location)
      where.location = {
        contains: location,
        mode: 'insensitive' as const,
      };
    if (workingHours) {
      where.workingHours = {
        contains: workingHours,
        mode: 'insensitive' as const,
      };
    }
    if (verified !== undefined) where.verified = verified;
    if (gymOwnerId) where.gymOwnerId = gymOwnerId; // For admin or owner use
    const [data, total] = await Promise.all([
      this.databaseservice.gym.findMany({
        where,
        skip,
        take: limit,
      }),
      this.databaseservice.gym.count({ where }),
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
    
    const gym = await this.databaseservice.gym.findUnique({
          where: {
            gymId: id
          },
          select: {
            gymId: true,
          },
        })
    
        if (!gym){
          throw new NotFoundException(`Gym with ID ${id} not found`)
        }

    return this.databaseservice.gym.findUnique({
      where: {
        gymId: id,
      },
    });
  }

  async update(id: number, updateGymsDto: UpdateGymsDto, currentUserId: number) {

     const gym= await this.databaseservice.gym.findUnique({
          where: {
            gymId: id
          },
          select: {
            gymId: true,
            gymOwnerId: true
          },
        })
    
        if (!gym){
          throw new NotFoundException(`Gym with ID ${id} not found`)
        }

      const ownerOrAdmin = await this.databaseservice.user.findUnique({
          where: { 
            userId: currentUserId
           },
          select:
           {
             userId: true, 
             role: true 
            },
        });
    
        if (!ownerOrAdmin) {
          throw new NotFoundException(`User with ID ${currentUserId} not found`);
        }

        if (ownerOrAdmin.role !== "ADMIN"){

          if (gym?.gymOwnerId !== currentUserId){
            throw new ForbiddenException('Cannot update gym you do not own')
          }
        

        if (ownerOrAdmin.role !== 'GYMOWNER') {
          throw new ForbiddenException(`User with ID ${currentUserId} is not a Gym owner`);
        }

      }

    return this.databaseservice.gym.update({
      where: {
        gymId: id,
      },
      data: updateGymsDto,
    });
  }

  async remove(id: number, currentUserId: number) {

    const gym = await this.databaseservice.gym.findUnique({
          where: {
            gymId: id
          },
          select: {
            gymId: true,
            gymOwnerId: true
          },
        })
    
        if (!gym){
          throw new NotFoundException(`Gym with ID ${id} not found`)
        }

        const adminRole = await this.databaseservice.user.findUnique({
            where: { 
              userId: currentUserId
            },
            select:
            {
              userId: true, 
              role: true 
              },
          });

        
      if (adminRole?.role !== "ADMIN"){
        if (gym?.gymOwnerId !== currentUserId){
                throw new ForbiddenException('Cannot delete gym you do not own')
              }
      }

    await this.databaseservice.gym.delete({
      where: {
        gymId: id,
      },
    });
  }
}