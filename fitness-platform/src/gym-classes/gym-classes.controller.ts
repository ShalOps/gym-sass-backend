import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { GymClassesService } from './gym-classes.service';
import { CreateGymClassesDto } from './dto/create-gym-classes.dto';
import { UpdateGymClassesDto } from './dto/update-gym-classes.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('gym-classes')
@Controller('gym-classes')
export class GymClassesController {
  constructor(private readonly gymClassesService: GymClassesService) {}

  @Post()
  @ApiOperation({summary: "Create a gym class for a given gym"})
  @ApiResponse({ status: 201, description: 'Gym class created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 404, description: 'Gym or trainer not found.' })
  create(@Body() createGymClassesDto: CreateGymClassesDto) {
    return this.gymClassesService.create(createGymClassesDto);
  }

  @Get()
  @ApiOperation({summary: "Get all the gym classes"})
  @ApiResponse({ status: 200, description: 'List of all gym classes.' })
  findAll() {
    return this.gymClassesService.findAll();
  }

  @Get(':id')
  @ApiOperation({summary: "Get a gym class by id"})
  @ApiResponse({ status: 200, description: 'Gym class found.' })
  @ApiResponse({ status: 404, description: 'Gym class not found.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gymClassesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({summary: "Update a gym class by id"})
  @ApiResponse({ status: 200, description: 'Gym class updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid update data.' })
  @ApiResponse({ status: 404, description: 'Gym class or referenced gym/trainer not found.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateGymClassesDto: UpdateGymClassesDto) {
    return this.gymClassesService.update(id, updateGymClassesDto);
  }

  @Delete(':id')
  @ApiOperation({summary: "Delete a gym class by id"})
  @ApiResponse({ status: 204, description: 'Gym class successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Gym class not found.' })
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.gymClassesService.remove(id);
  }
}
