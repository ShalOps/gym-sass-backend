import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import { GymClassesService } from './gym-classes.service';
import { CreateGymClassesDto } from './dto/create-gym-classes.dto';
import { UpdateGymClassesDto } from './dto/update-gym-classes.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';

@ApiTags('gym-classes')
@Controller('gym-classes')
export class GymClassesController {
  constructor(private readonly gymClassesService: GymClassesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a gym class for a given gym' })
  @ApiResponse({ status: 201, description: 'Gym class created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 404, description: 'Gym or trainer not found.' })
  @ApiBearerAuth('JWT-auth')
  create(
    @Body() createGymClassesDto: CreateGymClassesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gymClassesService.create(createGymClassesDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all the gym classes' })
  @ApiResponse({ status: 200, description: 'List of all gym classes.' })
  findAll() {
    return this.gymClassesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gym class by id' })
  @ApiResponse({ status: 200, description: 'Gym class found.' })
  @ApiResponse({ status: 404, description: 'Gym class not found.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gymClassesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a gym class by id' })
  @ApiResponse({ status: 200, description: 'Gym class updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid update data.' })
  @ApiResponse({
    status: 404,
    description: 'Gym class or referenced gym/trainer not found.',
  })
  @ApiBearerAuth('JWT-auth')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGymClassesDto: UpdateGymClassesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gymClassesService.update(
      id,
      updateGymClassesDto,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gym class by id' })
  @ApiResponse({ status: 204, description: 'Gym class successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Gym class not found.' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.gymClassesService.remove(id, req.user.userId);
  }
}
