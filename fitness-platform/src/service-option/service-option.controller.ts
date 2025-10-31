import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ServiceOptionService } from './service-option.service';
import { Prisma } from '@prisma/client'; 
import { CreateServiceOptionDto } from './dto/create-service-option.dto';
import { UpdateServiceOptionDto } from './dto/update-service-option.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('service-option')
@Controller('service-option')
export class ServiceOptionController {
  constructor(private readonly serviceOptionService: ServiceOptionService) {}

  @Post()
  @ApiOperation({summary: 'Create an option that can be added to a service'})
  @ApiResponse({ status: 201, description: 'Service‑option created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid request payload.' })
  @ApiResponse({ status: 409, description: 'Option name already exists for this gym ' })
  create(@Body() createServiceOptionDto: CreateServiceOptionDto) {
    return this.serviceOptionService.create(createServiceOptionDto);
  }

  @Get()
  @ApiOperation({summary: 'Get all service options that were created'})
  @ApiResponse({ status: 200, description: 'List of all service‑options.' })
  findAll() {
    return this.serviceOptionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service option by id' })
  @ApiResponse({ status: 200, description: 'Service‑option found.' })
  @ApiResponse({ status: 404, description: 'Service‑option not found.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceOptionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({summary: 'Update a service option by id'})
  @ApiResponse({ status: 200, description: 'Service option updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid update payload.' })
  @ApiResponse({ status: 404, description: 'Service option not found.' })
  @ApiResponse({ status: 409, description: 'Updated name conflicts with another option in the same gym.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateServiceOptionDto: UpdateServiceOptionDto) {
    return this.serviceOptionService.update(id, updateServiceOptionDto);
  }

  @Delete(':id')
  @ApiOperation({summary: 'Delete a service option by id'})
  @ApiResponse({ status: 204, description: 'Service option successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Service option not found.' })
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.serviceOptionService.remove(id);
  }
}
