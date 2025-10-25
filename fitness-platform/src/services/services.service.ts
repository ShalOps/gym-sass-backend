import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from 'src/database/database.service';
import { CreateServiceDto } from './dto/create-services.dto';
import { UpdateServiceDto } from './dto/update-services.dto'; 



@Injectable()
export class ServicesService {
  constructor(private readonly databaseservice: DatabaseService){}
  

  async create(createServiceDto: CreateServiceDto) {
 
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
}
