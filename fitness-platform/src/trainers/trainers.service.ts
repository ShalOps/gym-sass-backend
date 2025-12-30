import { BadRequestException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { Prisma, Role } from "@prisma/client";
import { UpdateTrainerDto } from "./dto/update-trainer.dto";
import { NotificationsService } from "src/notifications/notifications.service";


@Injectable()
export class TrainerService {
  constructor(private readonly databaseService: DatabaseService, private readonly notificationsService: NotificationsService  ) {}

  async createTrainer(dto: CreateTrainerDto,userId: number) {
        try {
          const data: Prisma.TrainerCreateInput =  {
            user: { connect: { userId: userId } },
            bio: dto.bio,
            gender: dto.gender,
            dob: dto.dob,
            hourlyRate: new Prisma.Decimal(dto.hourlyRate),
            certificationFiles: {
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
        // admin email
        const email = await this.databaseService.user.findFirst({where: {role: Role.ADMIN}});

        if (email) {
          this.notificationsService.notifyAdminVerificationRequest(email.email).catch((err) => {
            console.error('Failed to send admin notification email:', err);
          });
        }
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
        data: {
          bio: dto.bio,
          gender: dto.gender,
          dob: dto.dob,
          hourlyRate: dto.hourlyRate,
          yearsOfExperience: dto.yearsOfExperience,
          profilePicture: dto.profilePicture,
          verified: dto.verified,
          ...(dto.specializations && {
            specializations: {
              deleteMany: {},
              create: dto.specializations.map(s => ({
                category: s.category,
                detail: s.detail,
              })),
            },
          }),

          ...(dto.certificationFiles && {
            certificationFiles: {
              deleteMany: {},
              create: dto.certificationFiles,
            },
          }),
        },
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
      let verificationMessage: string | null = null;
      if (trainer.verified) {
        const isChangingSensitiveFields =
          dto.certificationFiles !== undefined ||
          dto.yearsOfExperience !== undefined ||
          dto.specializations !== undefined;

        if(isChangingSensitiveFields) {
          await this.requestNewProfileUpdate(id, {
            certificationFiles: dto.certificationFiles,
            yearsOfExperience: dto.yearsOfExperience,
            specializations: dto.specializations,
          });
          verificationMessage = 'Sensitive changes (Certs, Experience, Specializations) have been sent for Admin approval.';
        };
      }
        const data: Prisma.TrainerUpdateInput = {
          bio: dto.bio,
          gender: dto.gender,
          dob: dto.dob,
          hourlyRate: dto.hourlyRate,
          profilePicture: dto.profilePicture,
        };
         if (!trainer.verified) {
          if (dto.yearsOfExperience !== undefined) {
            data.yearsOfExperience = dto.yearsOfExperience;
          }

          if (dto.specializations) {
            data.specializations = {
              deleteMany: {},
              create: dto.specializations.map(s => ({
                category: s.category,
                detail: s.detail,
              })),
            };
          }

          if (dto.certificationFiles) {
            data.certificationFiles = {
              deleteMany: {},
              create: dto.certificationFiles,
            };
          }
        }
      const updatedTrainer = await this.databaseService.trainer.update({
        where: { id },
        data: data,
      });
      const adminemail = await this.databaseService.user.findFirst({where: {role: Role.ADMIN}});
      this.notificationsService.notifyAdminVerificationRequest(user.email).catch((err) => {
        console.error('Failed to send admin notification email:', err);
      });


      return {
        ...updatedTrainer,
        message: verificationMessage || 'Trainer updated successfully',
      };
    }

    throw new ForbiddenException('Unauthorized to update this trainer');

    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.log(error);
      throw new InternalServerErrorException('failed to update trainer');
    }

  }

  async uploadFiles(trainerId: number, files: { profilePicture?: string; certificationFiles?: string[] },userId: number) {
    const currentUser = await this.databaseService.user.findUnique({ where: { userId } });
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const trainer = await this.databaseService.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      throw new NotFoundException('Trainer not found');
    }
    if(currentUser.role === Role.TRAINER){
        if (trainer.userId !== userId) {
          throw new ForbiddenException('You do not have permission to upload files for other trainer');
        }
        const updateData: any = {};
        if (files.profilePicture) updateData.profilePicture = files.profilePicture;
        if (files.certificationFiles) updateData.certificationFiles = files.certificationFiles;
        return this.databaseService.trainer.update({
          where: { id: trainerId },
          data: updateData,
        });
    }
    throw new ForbiddenException('Only trainers can upload files for their profile');

  }

  async requestNewProfileUpdate(trainerId: number, dto: any) {
    try {
      const trainer = await this.databaseService.trainer.findUnique({ where: { id: trainerId } });
      if (!trainer) throw new NotFoundException('Trainer not found');
      return this.databaseService.verificationRequest.create({
        data: {
          trainerId: trainerId,
          status: 'PENDING',
          requestedChanges: dto as Prisma.InputJsonValue
        },
    });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.log(error);
      throw new InternalServerErrorException('failed to create verification request');
    }

  }

  async approveProfileUpdate(requestId: number,userId: number, body: any) {
    try {
      const request = await this.databaseService.verificationRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new BadRequestException('Verification request not found');
      }

      if(request.status !== 'PENDING') {
        throw new BadRequestException('This request has already been processed');
      }
      const user =  await this.databaseService.user.findUnique({where: {userId}});

      if(!user || user.role !== Role.ADMIN){
        throw new ForbiddenException('Only admins can approve profile updates');
      }
      const changes = request.requestedChanges as any;

      const tx: any[] = [];

      if (changes.yearsOfExperience !== undefined) {
        tx.push(
          this.databaseService.trainer.update({
            where: { id: request.trainerId },
            data: { yearsOfExperience: changes.yearsOfExperience },
          }),
        );
      }

      if (changes.specializations) {
        tx.push(
          this.databaseService.trainer.update({
            where: { id: request.trainerId },
            data: {
              specializations: {
                deleteMany: {},
                create: changes.specializations,
              },
            },
          }),
        );
      }

      if (changes.certificationFiles) {
        tx.push(
          this.databaseService.certification.createMany({
            data: changes.certificationFiles.map((c) => ({
              ...c,
              trainerId: request.trainerId,
            })),
          }),
        );
      }
      const status = body.status === 'REJECTED' ? 'REJECTED' : 'APPROVED';
      const adminNote = body.adminNote || (status === 'APPROVED' ? 'Approved after review' : 'Rejected after review');
      tx.push(
        this.databaseService.verificationRequest.update({
          where: { id: requestId },
          data: {
            status: status,
            updatedBy: userId,
            adminNote: adminNote,
          },
        }),
      );

    return this.databaseService.$transaction(tx);
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('failed to approve profile update');
    }

  }

  async verifyTrainer(trainerId: number,userId: number,verifyTrainer: boolean) {
    try {
      const trainer = await this.databaseService.trainer.findUnique({ where: { id: trainerId } });
      if (!trainer) {
        throw new NotFoundException('Trainer not found');
      }
      if(trainer.verified) {
        throw new BadRequestException('Trainer is already verified');
      }
      const user = await this.databaseService.user.findUnique({where: {userId}});
      if(!user || user.role !== Role.ADMIN){
        throw new ForbiddenException('Only admins can verify trainers');
      }
      const trainerVerificationStatus = verifyTrainer ? "APPROVED" : "REJECTED";
      return this.databaseService.trainer.update({
        where: { id: trainerId },
        data: { verified: verifyTrainer, verificationStatus: trainerVerificationStatus },
      });

    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.log(error);
      throw new InternalServerErrorException('failed to verify trainer');
    }
  }
}