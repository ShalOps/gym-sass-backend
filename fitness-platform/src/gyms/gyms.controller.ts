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

@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post()
  create(@Body() createGymsDto: CreateGymsDto) {
    return this.gymsService.create(createGymsDto);
  }

  @Get()
  findAll(@Query() query: any) {
    try {
      const pagination: PaginationDto = PaginationSchema.parse(query);
      return this.gymsService.findAll(pagination);
    } catch {
      throw new BadRequestException('Invalid pagination parameters');
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGymsDto: UpdateGymsDto) {
    return this.gymsService.update(+id, updateGymsDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.gymsService.remove(+id);
  }
}
