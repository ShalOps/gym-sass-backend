import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode } from '@nestjs/common';
import { ServiceOptionAssignmentService } from './service-option-assignment.service';
import { CreateServiceOptionAssignmentDto } from './dto/create-service-option-assignment.dto';
import { UpdateServiceOptionAssignmentDto } from './dto/update-service-option-assignment.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('service-option-assignment')
@Controller('service-option-assignment')
export class ServiceOptionAssignmentController {
  constructor(private readonly serviceOptionAssignmentService: ServiceOptionAssignmentService) {}

  @Post()
  @ApiOperation({summary: "Add an option to a service for a given gym"})
  @ApiResponse({ status: 201, description: 'Option successfully attached to the service.' })
  @ApiResponse({ status: 400, description: 'Invalid payload.' })
  @ApiResponse({ status: 409, description: 'Assignment already exists.' })
  create(@Body() createServiceOptionAssignmentDto: CreateServiceOptionAssignmentDto) {
    return this.serviceOptionAssignmentService.create(createServiceOptionAssignmentDto);
  }

  @Get()
  @ApiOperation({summary: "Get all service and option relations for each gym"})
  @ApiResponse({ status: 200, description: 'List of assignment records.' })
  findAll() {
    return this.serviceOptionAssignmentService.findAll();
  }

  @Get(':id')
  @ApiOperation({summary: "Get a single service and option pairing by id"})
  @ApiResponse({ status: 200, description: 'Assignment found.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  findOne(@Param('id') id: string) {
    return this.serviceOptionAssignmentService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({summary: "Update a single service and option pairing by id"})
  @ApiResponse({ status: 200, description: 'Assignment updated.' })
  @ApiResponse({ status: 400, description: 'Invalid update payload.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  @ApiResponse({ status: 409, description: 'New combination violates unique constraint.',
  })
  update(@Param('id') id: string, @Body() updateServiceOptionAssignmentDto: UpdateServiceOptionAssignmentDto) {
    return this.serviceOptionAssignmentService.update(+id, updateServiceOptionAssignmentDto);
  }

  @Delete(':id')
  @ApiOperation({summary: "Delete a single service and option pairing by id"})
  @ApiResponse({ status: 204, description: 'Assignment successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.serviceOptionAssignmentService.remove(+id);
  }
}
