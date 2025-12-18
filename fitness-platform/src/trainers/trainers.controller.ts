import { Body, Controller, Post } from "@nestjs/common";
import { TrainerService } from "./trainers.service";
import { CreateTrainerDto } from "./dto/create-trainer.dto";

@Controller('trainers')
export class TrainerController {
  constructor(private readonly trainerService: TrainerService) {}

  @Post()
  create(@Body() dto: CreateTrainerDto) {
    return this.trainerService.createTrainer(dto);
  }
}