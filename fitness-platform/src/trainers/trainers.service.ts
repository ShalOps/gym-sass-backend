import { ForbiddenException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { Prisma, Role } from "@prisma/client";
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
            certifications: {
              create: dto.certificationFiles.map(cert => ({
                name: cert.name,
                issuingOrganization: cert.issuingOrganization,
                issueDate: new Date(cert.issueDate),
                expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
                fileUrl: cert.fileUrl
              }))
            },
            yearsOfExperience: dto.yearsOfExperience,
            specializations: {
              create: dto.specializations.map(spec => ({
                category: spec.category,
                detail: spec.detail
              }))
            },
            profilePicture: dto.profilePicture,
            verified: dto.verified,
          };

        return this.databaseService.trainer.create({ data:{
          ...data,
          user: { connect: { userId: userId } }
        } });

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
        if (error instanceof HttpException) throw error;
        console.log(error);
        throw new InternalServerErrorException('failed to get trainer');
    }

  }
  async updateTrainer(id: number, dto: UpdateTrainerDto, userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({where: {userId}});
    if(!user){
      throw new NotFoundException('This user does not exist');
    }
    const userRole = user?.role;
    if (userRole === Role.ADMIN) {
      return this.databaseService.trainer.update({
        where: { id: id },
        data: dto
      });
    }
    if(userRole === Role.TRAINER ){
      const trainer = await this.databaseService.trainer.findUnique({where: {id}});

      if(!trainer){
        throw new NotFoundException('Trainer not found');
      }
      if(trainer.userId !== userId){
        throw new NotFoundException('Trainers can only update their own profile');
      }
      if (trainer.verified) {
        const isChangingSensitiveFields =
          dto.certificationFiles ||
          dto.yearsOfExperience ||
          dto.specializations;
        if(isChangingSensitiveFields) {
          await this.databaseService.verificationRequest.create({
            data:{
              trainerId: trainer.id,
              requestedChanges: {
                certificationFiles: dto.certificationFiles,
                yearsOfExperience: dto.yearsOfExperience,
                specializations: dto.specializations
              }
            }
          });
        };

        delete dto.certificationFiles;
        delete dto.specializations;
        delete dto.yearsOfExperience;
      }

      const {verified, ...allowedData} = dto;
      return this.databaseService.trainer.update({
        where: { id },
        data: allowedData,
      });
    }

    throw new ForbiddenException('Unauthorized to update this trainer');

    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.log(error);
      throw new InternalServerErrorException('failed to update trainer');
    }

  }
  async linkToUser(trainerId: number, userId: number) {
    return this.databaseService.trainer.update({
      where: { id: trainerId },
      data: { userId },
    });
  }

  async uploadFiles(trainerId: number, files: { profilePicture?: string; certificationFiles?: string[] }) {
    const updateData: any = {};
    if (files.profilePicture) updateData.profilePicture = files.profilePicture;
    if (files.certificationFiles) updateData.certificationFiles = files.certificationFiles;
    return this.databaseService.trainer.update({
      where: { id: trainerId },
      data: updateData,
    });
  }

}