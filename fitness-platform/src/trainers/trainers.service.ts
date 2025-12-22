import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { Prisma } from "@prisma/client";
import { UpdateTrainerDto } from "./dto/update-trainer.dto";

@Injectable()
export class TrainerService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTrainer(dto: CreateTrainerDto,userId: number) {
        try {
          const data: Prisma.TrainerCreateInput =  {
            user: { connect: { userId: userId } },
            bio: dto.bio,
            gender: dto.gender,
            dob: dto.dob,
            hourlyRate: new Prisma.Decimal(dto.hourlyRate),
            specializations: dto.specializations,
            yearsOfExperience: dto.yearsOfExperience,
            certificationFiles: dto.certificationFiles,
            profilePicture: dto.profilePicture,
            verified: dto.verified,
          };

        return this.databaseService.trainer.create({ data });
        } catch (error) {
          if(error.code === 'P2002') {
            throw new Error('Trainer for this user already exists.');
          }

          if(error.code === 'P2023') {
            throw new Error('Invalid data type provided.');
          }

          if(error.code === 'P2003' || error.code === 'P2025') {
            throw new Error('Referenced user does not exist.');
          }

          throw new InternalServerErrorException('failed to create trainer');
        }
  }

  async getTrainer(id: number) {
    try {
        const trainer = await this.databaseService.trainer.findUnique({
          where: { id },
          include: { user: true },
        });

        if (!trainer) {
          throw new NotFoundException('Trainer not found');
        }

        return trainer;
    } catch (error) {
        throw new InternalServerErrorException('failed to get trainer');
    }

  }

  
}