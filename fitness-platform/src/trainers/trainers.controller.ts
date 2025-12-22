import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { TrainerService } from "./trainers.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { Roles } from "src/auth/roles.decorator";

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
}