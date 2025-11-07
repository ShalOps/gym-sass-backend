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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-services.dto';
import { UpdateServiceDto } from './dto/update-services.dto';
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

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({
    status: 409,
    description: 'Service with this name already exists in the gym.',
  })
  @ApiBearerAuth('JWT-auth')
  create(
    @Body() createServiceDto: CreateServiceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.servicesService.create(createServiceDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Find all created services' })
  @ApiResponse({ status: 200, description: 'List of all services.' })
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a service by id' })
  @ApiResponse({ status: 200, description: 'Service found.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a service by id' })
  @ApiResponse({ status: 200, description: 'Service successfully updated.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  @ApiResponse({
    status: 409,
    description:
      'Updated name conflicts with existing service in the same gym.',
  })
  @ApiBearerAuth('JWT-auth')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceDto: UpdateServiceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.servicesService.update(id, updateServiceDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service by id' })
  @ApiResponse({ status: 204, description: 'Service successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.servicesService.remove(id, req.user.userId);
  }
}
