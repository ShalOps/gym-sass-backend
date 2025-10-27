import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service'; 
import { CreateGymClassesDto } from './dto/create-gym-classes.dto';
import { UpdateGymClassesDto } from './dto/update-gym-classes.dto';



@Injectable()
export class GymClassesService {
  constructor(private readonly databaseservice: DatabaseService){}

  async create(createGymClassesDto: CreateGymClassesDto) {

    const gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: createGymClassesDto.gymId
      },
      select: {
        gymId: true,
      },
    })

    if (!gym){
      throw new NotFoundException(`Gym with ID ${createGymClassesDto.gymId} not found`)
    }

    const trainer = await this.databaseservice.user.findUnique({
      where: { 
        userId: createGymClassesDto.trainerId
       },
      select:
       {
         userId: true, 
         role: true 
        },
    });

    if (!trainer) {
      throw new NotFoundException(`User with ID ${createGymClassesDto.trainerId} not found`);
    }
    if (trainer.role !== 'TRAINER') {
      throw new ForbiddenException(`User with ID ${createGymClassesDto.trainerId} is not a trainer`);
    }

    return this.databaseservice.gymClasses.create({
      data: createGymClassesDto,
    });
  }

  async findAll() {
    return this.databaseservice.gymClasses.findMany({
      include: {
        gym: true,
        trainer: true,
      }
    });
  }

  async findOne(id: number) {
   
    const gymClass = await this.databaseservice.gymClasses.findUnique({
    where: {
      classId: id
      }
    });

    if (!gymClass) {
      throw new NotFoundException(`Gym class with ID ${id} not found`)
    }
    
    return this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id,
      },
      include: {
        gym: true,
        trainer: true
      }
    });
  }

  async update(id: number, updateGymClassesDto: UpdateGymClassesDto) {

    if (updateGymClassesDto.gymId){

      const gym= await this.databaseservice.gym.findUnique({
      where: {
        gymId: updateGymClassesDto.gymId
      },
      select: {
        gymId: true,
        },
      })

      if (!gym){
        throw new NotFoundException(`Gym with ID ${updateGymClassesDto.gymId} not found`)
      }

    }
    
    
    if (updateGymClassesDto.trainerId){

      const trainer = await this.databaseservice.user.findUnique({
      where: { 
        userId: updateGymClassesDto.trainerId 
      },
      select:
       {
         userId: true, 
         role: true 
        },
      });

    if (!trainer) {
      throw new NotFoundException(`User with ID ${updateGymClassesDto.trainerId} not found`);
    }
    if (trainer.role !== 'TRAINER') {
      throw new ForbiddenException(`User with ID ${updateGymClassesDto.trainerId} is not a trainer`);
    }

    }
    


    const gymClass = await this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id
      }
    });

      if (!gymClass) {
        throw new NotFoundException(`Gym class with ID ${id} not found`)
      }
      
      return this.databaseservice.gymClasses.update({
        where: {
          classId: id
        },
        data: updateGymClassesDto,
      });
  }

  async remove(id: number) {
    const gymClass = await this.databaseservice.gymClasses.findUnique({
      where: {
        classId: id
      }
    });

    if (!gymClass) {
      throw new NotFoundException(`Gym class with ID ${id} not found`)
    }

    await this.databaseservice.gymClasses.delete({
      where: {
        classId: id
      }
    });
  }
}
