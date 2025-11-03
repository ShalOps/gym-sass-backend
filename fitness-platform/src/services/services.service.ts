import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateServiceDto } from './dto/create-services.dto';
import { UpdateServiceDto } from './dto/update-services.dto'; 


@Injectable()
export class ServicesService {
  constructor(private readonly databaseservice: DatabaseService){}
  

  async create(createServiceDto: CreateServiceDto, currentUserId: number) {

    const gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: createServiceDto.gymId
      },
      select: {
        gymId: true,
        gymOwnerId: true,
      },
    })

    if (!gym){
      throw new NotFoundException(`Gym with ID ${createServiceDto.gymId} not found`)
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

    if(ownerOrAdmin?.role !== "ADMIN"){
        if (gym?.gymOwnerId !== currentUserId){
          throw new ForbiddenException(`Cannot create a service for a gym you do not own`)
      }
                
      }
 
    return this.databaseservice.service.create({
      data: createServiceDto
    })
  }

  async findAll() {
    
    return this.databaseservice.service.findMany({
      include: {
        gym: true,
        optionAssignments: true,
    },
    });
  }

  async findOne(id: number) {
   
    const service = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
    });
    
    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return this.databaseservice.service.findUnique({
      where: {
        serviceId: id,
      },
      include: {
        gym: true,
        optionAssignments: true,
    },
    });
  }

  async update(id: number, updateServiceDto: UpdateServiceDto, currentUserId: number) {

    let gym: { gymId: number, gymOwnerId: number } | null = null;

    if (updateServiceDto.gymId){

      gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: updateServiceDto.gymId
      },
      select: {
        gymId: true,
        gymOwnerId: true
        },
      })

      if (!gym){
        throw new NotFoundException(`Gym with ID ${updateServiceDto.gymId} not found`)
      }

    } 
    else {
      const result = await this.databaseservice.service.findUnique({
        where: {
          serviceId: id
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
   
    const service = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    const ownerOrAdmin = await this.databaseservice.user.findUnique({
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
            throw new ForbiddenException(`Cannot update service you do not own`)
          }
            
        }

    return this.databaseservice.service.update({
      where: {
        serviceId: id,
      },
      data: updateServiceDto
    })
  }

  async remove(id: number, currentUserId: number) {
    
    const service = await this.databaseservice.service.findUnique({
      where: { 
        serviceId: id 
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

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }
    
    const ownerOrAdmin = await this.databaseservice.user.findUnique({
        where: {
          userId: currentUserId
        },
        select: {
          userId: true,
          role: true,
        }
      })


    if(ownerOrAdmin?.role !== "ADMIN"){
      
        if (service?.gym.gymOwnerId !== currentUserId){
          throw new ForbiddenException(`Cannot delete a service you do not own`)
        }
            
    }

    await this.databaseservice.service.delete({
      where: {
        serviceId: id,
      }
    })
  }


}
