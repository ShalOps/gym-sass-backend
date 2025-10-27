import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service'; 
import { CreateServiceOptionDto } from './dto/create-service-option.dto';
import { UpdateServiceOptionDto } from './dto/update-service-option.dto';

@Injectable()
export class ServiceOptionService {
  constructor(private readonly databaseservice: DatabaseService){}

  async create(createServiceOptionDto: CreateServiceOptionDto) {
    return this.databaseservice.serviceOption.create({
      data: createServiceOptionDto
    });
  }

  async findAll() {
    return this.databaseservice.serviceOption.findMany({
      include: {
        service: true,
    },
    });
  }

  async findOne(id: number) {

    const serviceOption = await this.databaseservice.serviceOption.findUnique({
          where: { 
            optionId: id
           },
        });
    if (!serviceOption) {
      throw new NotFoundException(`Service Option with ID ${id} not found`);
    }

    return this.databaseservice.serviceOption.findUnique({
      where: {
        optionId: id,
      },
      include: {
        service: true,
    },
    });
  }

  async update(id: number, updateServiceOptionDto: UpdateServiceOptionDto) {
     
      const serviceOption = await this.databaseservice.serviceOption.findUnique({
          where: { 
            optionId: id
           },
        });
        if (!serviceOption) {
          throw new NotFoundException(`Service Option with ID ${id} not found`);
        }
    
      return this.databaseservice.serviceOption.update({
        where: {
          optionId: id,
        },
        data: updateServiceOptionDto,
      });
  }

  async remove(id: number) {
    const serviceOption = await this.databaseservice.serviceOption.findUnique({
          where: { optionId: id },
        });
        if (!serviceOption) {
          throw new NotFoundException(`Service option with ID ${id} not found`);
        }

    await this.databaseservice.serviceOption.delete({
      where: {
        optionId: id
      }
    });
  }
}
