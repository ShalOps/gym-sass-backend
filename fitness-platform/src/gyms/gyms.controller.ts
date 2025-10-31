import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { GymsService } from './gyms.service';
import { Prisma } from '@prisma/client';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';
import { PaginationSchema, PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('gyms')
@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a new gym' })
  @ApiResponse({ status: 201, description: 'Gym created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth('JWT-auth')
  create(@Body() createGymsDto: CreateGymsDto) {
    return this.gymsService.create(createGymsDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of gyms' })
  @ApiResponse({ status: 200, description: 'List of gyms' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  findAll(@Query() query: any) {
    try {
      const pagination: PaginationDto = PaginationSchema.parse(query);
      return this.gymsService.findAll(pagination);
    } catch {
      throw new BadRequestException('Invalid pagination parameters');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gym by ID' })
  @ApiResponse({ status: 200, description: 'Gym data' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update gym by ID' })
  @ApiResponse({ status: 200, description: 'Gym updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiBearerAuth('JWT-auth')
  update(@Param('id') id: string, @Body() updateGymsDto: UpdateGymsDto) {
    return this.gymsService.update(+id, updateGymsDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete gym by ID' })
  @ApiResponse({ status: 200, description: 'Gym deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.gymsService.remove(+id);
  }
}
