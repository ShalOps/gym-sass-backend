import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { TrainerService } from "./trainers.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { Roles } from "src/auth/roles.decorator";
import { UpdateTrainerDto } from "./dto/update-trainer.dto";
import { Role } from "@prisma/client";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

@Controller('trainers')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles('TRAINER')
  @Post()
  create(
    @Body() dto: CreateTrainerDto,
    @Req() req:any
  ) {
    const userId = req.user.userId;
    return this.trainerService.createTrainer(dto, userId);
  }


  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles('TRAINER', 'GYMOWNER', 'ADMIN')
  @Get(':id')
  getTrainer(@Param('id') id: number) {
    return this.trainerService.getTrainer(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TRAINER, Role.GYMOWNER, Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainerDto,@Req() req:any) {
    const userId = req.user.userId;
    return this.trainerService.updateTrainer(+id, dto, userId);
  }


  @Post(':id/upload')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'certificationFiles', maxCount: 10 },
    ], {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: {
      profilePicture?: Express.Multer.File[],
      certificationFiles?: Express.Multer.File[]
    },
  ) {
    // Extract the paths to save in the DB
    const filePaths = {
      profilePicture: files.profilePicture?.[0]?.path,
      certificationFiles: files.certificationFiles?.map(f => f.path),
    };

    return this.trainerService.uploadFiles(id, filePaths);
  }
}


