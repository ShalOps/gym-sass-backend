import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ServiceOptionService } from './service-option.service';
import { Prisma } from '@prisma/client'; 
import { CreateServiceOptionDto } from './dto/create-service-option.dto';
import { UpdateServiceOptionDto } from './dto/update-service-option.dto';



@Controller('service-option')
export class ServiceOptionController {
  constructor(private readonly serviceOptionService: ServiceOptionService) {}

  @Post()
  create(@Body() createServiceOptionDto: CreateServiceOptionDto) {
    return this.serviceOptionService.create(createServiceOptionDto);
  }

  @Get()
  findAll() {
    return this.serviceOptionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceOptionService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateServiceOptionDto: UpdateServiceOptionDto) {
    return this.serviceOptionService.update(id, updateServiceOptionDto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.serviceOptionService.remove(id);
  }
}
