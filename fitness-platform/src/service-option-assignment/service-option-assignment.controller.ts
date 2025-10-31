import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode } from '@nestjs/common';
import { ServiceOptionAssignmentService } from './service-option-assignment.service';
import { CreateServiceOptionAssignmentDto } from './dto/create-service-option-assignment.dto';
import { UpdateServiceOptionAssignmentDto } from './dto/update-service-option-assignment.dto';

@Controller('service-option-assignment')
export class ServiceOptionAssignmentController {
  constructor(private readonly serviceOptionAssignmentService: ServiceOptionAssignmentService) {}

  @Post()
  create(@Body() createServiceOptionAssignmentDto: CreateServiceOptionAssignmentDto) {
    return this.serviceOptionAssignmentService.create(createServiceOptionAssignmentDto);
  }

  @Get()
  findAll() {
    return this.serviceOptionAssignmentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceOptionAssignmentService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateServiceOptionAssignmentDto: UpdateServiceOptionAssignmentDto) {
    return this.serviceOptionAssignmentService.update(+id, updateServiceOptionAssignmentDto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.serviceOptionAssignmentService.remove(+id);
  }
}
