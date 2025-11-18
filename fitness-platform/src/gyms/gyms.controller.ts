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
  Req,
} from '@nestjs/common';
import { GymsService } from './gyms.service';
import { Prisma } from '@prisma/client';
import { CreateGymsDto } from './dto/create-gyms.dto';
import { UpdateGymsDto } from './dto/update-gyms.dto';
import { PaginationSchema, PaginationDto } from './dto/pagination.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('gyms')
@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create a new gym' })
  @ApiBody({
    description: 'Gym creation data',
    schema: {
      type: 'object',
      required: ['gymName', 'location', 'gymOwnerId'],
      properties: {
        gymName: { type: 'string', description: 'Unique gym name' },
        contactNo: { type: 'string', description: 'Contact phone number' },
        location: { type: 'string', description: 'Gym location' },
        workingHours: { type: 'string', description: 'Working hours' },
        verified: {
          type: 'boolean',
          description: 'Verification status',
          default: false,
        },
        gymOwnerId: { type: 'number', description: 'Gym owner user ID' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Gym created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiBearerAuth('JWT-auth')
  create(@Body() createGymsDto: CreateGymsDto, @Req() req: RequestWithUser) {
    return this.gymsService.create(createGymsDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of gyms' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    type: String,
    description: 'Location filter',
  })
  @ApiQuery({
    name: 'workingHours',
    required: false,
    type: String,
    description: 'Working hours filter',
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: Boolean,
    description: 'Verified status filter',
  })
  @ApiQuery({
    name: 'gymOwnerId',
    required: false,
    type: Number,
    description: 'Gym owner ID filter',
  })
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
  @ApiParam({ name: 'id', type: Number, description: 'Gym ID' })
  @ApiResponse({ status: 200, description: 'Gym data' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update gym by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Gym ID' })
  @ApiBody({
    description: 'Gym update data (all fields optional)',
    schema: {
      type: 'object',
      properties: {
        gymName: { type: 'string', description: 'Unique gym name' },
        contactNo: { type: 'string', description: 'Contact phone number' },
        location: { type: 'string', description: 'Gym location' },
        workingHours: { type: 'string', description: 'Working hours' },
        verified: { type: 'boolean', description: 'Verification status' },
        gymOwnerId: { type: 'number', description: 'Gym owner user ID' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Gym updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiBearerAuth('JWT-auth')
  update(
    @Param('id') id: string,
    @Body() updateGymsDto: UpdateGymsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.gymsService.update(+id, updateGymsDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete gym by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Gym ID' })
  @ApiResponse({ status: 200, description: 'Gym deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Gym not found' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.gymsService.remove(+id, req.user.userId);
  }
}
