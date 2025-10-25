import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { GymClassesService } from './gym-classes.service';
import { CreateGymClassesDto } from './dto/create-gym-classes.dto';
import { UpdateGymClassesDto } from './dto/update-gym-classes.dto';


@Controller('gym-classes')
export class GymClassesController {
  constructor(private readonly gymClassesService: GymClassesService) {}

  @Post()
  create(@Body() createGymClassesDto: CreateGymClassesDto) {
    return this.gymClassesService.create(createGymClassesDto);
  }

  @Get()
  findAll() {
    return this.gymClassesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gymClassesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateGymClassesDto: UpdateGymClassesDto) {
    return this.gymClassesService.update(id, updateGymClassesDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.gymClassesService.remove(id);
  }
}