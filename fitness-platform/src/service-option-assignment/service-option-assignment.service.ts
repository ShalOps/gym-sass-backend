import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceOptionAssignmentDto } from './dto/create-service-option-assignment.dto';
import { UpdateServiceOptionAssignmentDto } from './dto/update-service-option-assignment.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ServiceOptionAssignmentService {
  constructor(private readonly databaseService: DatabaseService){}

  async create(createServiceOptionAssignmentDto: CreateServiceOptionAssignmentDto) {

    const service = await this.databaseService.service.findUnique(
      {
        where: {
          serviceId: createServiceOptionAssignmentDto.serviceId
        },
        select: {
          gymId: true
        },

      }
    )


    if (!service){
      throw new NotFoundException(`Service with id ${createServiceOptionAssignmentDto.serviceId} not found`)
    }

    const option = await this.databaseService.serviceOption.findUnique(
      {
        where: {
          optionId: createServiceOptionAssignmentDto.optionId
        },
        select: {
          gymId: true
        }
      }
    )

    

    if (!option){
      throw new NotFoundException(`Service option with id ${createServiceOptionAssignmentDto.optionId} not found`)
    }

    if (service?.gymId !== option?.gymId){
      throw new ForbiddenException(`Servive and Service option must be member of the same gym`)
    }

    return this.databaseService.serviceOptionAssignment.create({
      data: createServiceOptionAssignmentDto
    });
  }

  async findAll() {
    return this.databaseService.serviceOptionAssignment.findMany();
  }

  async findOne(id: number) {

    const serviceOptionAssignment = await this.databaseService.serviceOptionAssignment.findUnique({
      where: {
        optionAssignmentId: id
      }});
      
      if (!serviceOptionAssignment){
        throw new NotFoundException(`Service option assignment with id ${id} not found `)
      }

    return serviceOptionAssignment;
  }

  async update(id: number, updateServiceOptionAssignmentDto: UpdateServiceOptionAssignmentDto) {
   
    const serviceOptionAssignment = await this.databaseService.serviceOptionAssignment.findUnique({
      where: {
        optionAssignmentId: id
      }});
      
    if (!serviceOptionAssignment){
      throw new NotFoundException(`Service option assignment with id ${id} not found `)
    }

    return this.databaseService.serviceOptionAssignment.update({
      where: {
        optionAssignmentId: id
      },
      data: updateServiceOptionAssignmentDto
    })
    
  }

  async remove(id: number) {
    const serviceOptionAssignment = await this.databaseService.serviceOptionAssignment.findUnique({
      where: {
        optionAssignmentId: id
      }});
      
      if (!serviceOptionAssignment){
        throw new NotFoundException(`Service option assignment with id ${id} not found `)
      }
     
      await this.databaseService.serviceOptionAssignment.delete({
        where: {
          optionAssignmentId: id
        }
      })
  }
}
