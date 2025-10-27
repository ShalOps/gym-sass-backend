import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateServiceDto } from './dto/create-services.dto';
import { UpdateServiceDto } from './dto/update-services.dto'; 
import { UpdateSingleServiceOptionDto } from 'src/services/dto/update-single-service-option.dto';



@Injectable()
export class ServicesService {
  constructor(private readonly databaseservice: DatabaseService){}
  

  async create(createServiceDto: CreateServiceDto) {

    const gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: createServiceDto.gymId
      },
      select: {
        gymId: true,
      },
    })

    if (!gym){
      throw new NotFoundException(`Gym with ID ${createServiceDto.gymId} not found`)
    }
 
    return this.databaseservice.service.create({
      data: createServiceDto
    })
  }

  async findAll() {
    
    return this.databaseservice.service.findMany({
      include: {
        gym: true,
        options: true,
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
        options: true,
    },
    });
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {

    if (updateServiceDto.gymId){

      const gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: updateServiceDto.gymId
      },
      select: {
        gymId: true,
        },
      })

      if (!gym){
        throw new NotFoundException(`Gym with ID ${updateServiceDto.gymId} not found`)
      }

    }
   
    const service = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return this.databaseservice.service.update({
      where: {
        serviceId: id,
      },
      data: updateServiceDto
    })
  }

  async remove(id: number) {
    
    const service = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    await this.databaseservice.service.delete({
      where: {
        serviceId: id,
      }
    })
  }

  async updateServiceOptions(id: number, updateSingleServiceOptionDto: UpdateSingleServiceOptionDto) {
    const service = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
      include: { options: true },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    const existingOption = await this.databaseservice.serviceOption.findUnique({
      where: { optionId: updateSingleServiceOptionDto.optionId },
    });

    if (!existingOption || existingOption.serviceId !== id) {
      throw new NotFoundException(
        `Service option with ID ${updateSingleServiceOptionDto.optionId} not found or does not belong to service ${id}`,
      );
    }

    const updatedOption = await this.databaseservice.serviceOption.update({
      where: { optionId: updateSingleServiceOptionDto.optionId },
      data: {
        name: updateSingleServiceOptionDto.name,
        included: updateSingleServiceOptionDto.included,
      },
    });

    const updatedService = await this.databaseservice.service.findUnique({
      where: { serviceId: id },
      include: { options: true },
    });

  return updatedService
  }


}
