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
} from '@nestjs/common';
import { GymsService } from './gyms.service';
import { Prisma } from '../../generated/prisma';
import { PaginationSchema, PaginationDto } from './dto/pagination.dto';

@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Post()
  create(@Body() createGymDto: Prisma.GymCreateInput) {
    return this.gymsService.create(createGymDto);
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
  update(@Param('id') id: string, @Body() updateGymDto: Prisma.GymUpdateInput) {
    return this.gymsService.update(+id, updateGymDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gymsService.remove(+id);
  }
}
