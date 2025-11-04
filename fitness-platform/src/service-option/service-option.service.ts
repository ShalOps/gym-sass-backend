import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service'; 
import { CreateServiceOptionDto } from './dto/create-service-option.dto';
import { UpdateServiceOptionDto } from './dto/update-service-option.dto';

@Injectable()
export class ServiceOptionService {
  constructor(private readonly databaseService: DatabaseService){}

  async create(createServiceOptionDto: CreateServiceOptionDto, currentUserId: number) {
    
    const gym= await this.databaseService.gym.findUnique({
      where: {
        gymId: createServiceOptionDto.gymId
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    })

    if (!gym){
      throw new NotFoundException(`Gym with ID ${createServiceOptionDto.gymId} not found`)
    }
    
    const ownerOrAdmin = await this.databaseService.user.findUnique({
      where: { 
          userId: currentUserId
          },
      select: {
            userId: true, 
            role: true 
          },
      });
    
      if(ownerOrAdmin?.role !== "ADMIN"){
          if (gym?.gymOwnerId !== currentUserId){
            throw new ForbiddenException(`Cannot create a service for a gym you do not own`)
        }
                    
          }
    return this.databaseService.serviceOption.create({
      data: createServiceOptionDto
    });
  }

  async findAll() {
    return this.databaseService.serviceOption.findMany({
      include: {
        gym: true,
    },
    });
  }

  async findOne(id: number) {

    const serviceOption = await this.databaseService.serviceOption.findUnique({
          where: { 
            optionId: id
           },
        });
    if (!serviceOption) {
      throw new NotFoundException(`Service Option with ID ${id} not found`);
    }

    return this.databaseService.serviceOption.findUnique({
      where: {
        optionId: id,
      },
      include: {
        gym: true,
    },
    });
  }

  async update(id: number, updateServiceOptionDto: UpdateServiceOptionDto, currentUserId: number) {
     
      let gym: {gymId: number, gymOwnerId: number} | null = null;

      if(updateServiceOptionDto.gymId){

        gym = await this.databaseService.gym.findUnique({
          where: {
            gymId: updateServiceOptionDto.gymId
          },
          select: {
            gymId: true,
            gymOwnerId: true,
          }
        })
      }
      else {
        const result = await this.databaseService.serviceOption.findUnique({
          where: {
            optionId: id
          },
          select: {
              gym: {
              select: {
                gymId: true,      
                gymOwnerId: true,  
              }
            }
          }
        })
      gym = result?.gym ?? null;
      }

      const serviceOption = await this.databaseService.serviceOption.findUnique({
          where: { 
            optionId: id
           },
        });
        if (!serviceOption) {
          throw new NotFoundException(`Service Option with ID ${id} not found`);
        }
    
      const ownerOrAdmin = await this.databaseService.user.findUnique({
        where: {
          userId: currentUserId
        },
        select: {
          userId: true,
          role: true,
        }
      })


      if(ownerOrAdmin?.role !== "ADMIN"){
          if (gym?.gymOwnerId !== currentUserId){
            throw new ForbiddenException(`Cannot update service option you do not own`)
          }
            
        }

      return this.databaseService.serviceOption.update({
        where: {
          optionId: id,
        },
        data: updateServiceOptionDto,
      });
  }

  async remove(id: number, currentUserId: number) {
    
    const serviceOption = await this.databaseService.serviceOption.findUnique({
          where: { 
            optionId: id 
          },
          select: {
            gym: {
              select: {
                gymId: true,
                gymOwnerId: true,
              }
            }
          }
        });
        if (!serviceOption) {
          throw new NotFoundException(`Service option with ID ${id} not found`);
        }

    const ownerOrAdmin = await this.databaseService.user.findUnique({
        where: {
          userId: currentUserId
        },
        select: {
          userId: true,
          role: true,
        }
      })


    if(ownerOrAdmin?.role !== "ADMIN"){
      
        if (serviceOption?.gym.gymOwnerId !== currentUserId){
          throw new ForbiddenException(`Cannot delete a service option you do not own`)
        }
            
    }
    await this.databaseService.serviceOption.delete({
      where: {
        optionId: id
      }
    });
  }
}
