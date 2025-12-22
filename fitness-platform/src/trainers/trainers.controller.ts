import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { TrainerService } from "./trainers.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { Roles } from "src/auth/roles.decorator";
import { UpdateTrainerDto } from "./dto/update-trainer.dto";
import { Role } from "@prisma/client";

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
}