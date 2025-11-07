import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ServiceBookingsService } from './service-bookings.service';
import { CreateServiceBookingDto } from './dto/create-service-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingStatus } from '@prisma/client';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('service-bookings')
@Controller('bookings/services')
@UseGuards(JwtAuthGuard)
export class ServiceBookingsController {
  constructor(
    private readonly serviceBookingsService: ServiceBookingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get user's service bookings with optional filters",
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of service bookings with metadata.',
  })
  @ApiBearerAuth('JWT-auth')
  findAll(
    @Request() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: {
      status?: BookingStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {};

    if (
      status &&
      Object.values(BookingStatus).includes(status as BookingStatus)
    ) {
      filters.status = status as BookingStatus;
    }

    if (startDate) {
      filters.startDate = new Date(startDate);
    }

    if (endDate) {
      filters.endDate = new Date(endDate);
    }

    if (page) {
      filters.page = parseInt(page, 10);
    }

    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    return this.serviceBookingsService.findAll(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific service booking by ID' })
  @ApiResponse({ status: 200, description: 'Service booking details.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @ApiBearerAuth('JWT-auth')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service booking' })
  @ApiResponse({
    status: 201,
    description: 'Service booking created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or business rule violation.',
  })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  @ApiBearerAuth('JWT-auth')
  create(
    @Body() createServiceBookingDto: CreateServiceBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.create(
      req.user.userId,
      createServiceBookingDto.serviceId,
      createServiceBookingDto.startTime
        ? new Date(createServiceBookingDto.startTime)
        : undefined,
      createServiceBookingDto.endTime
        ? new Date(createServiceBookingDto.endTime)
        : undefined,
      createServiceBookingDto.notes,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service booking' })
  @ApiResponse({
    status: 200,
    description: 'Service booking updated successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or business rule violation.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @ApiBearerAuth('JWT-auth')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.update(
      id,
      updateBookingDto,
      req.user.userId,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a service booking' })
  @ApiResponse({
    status: 200,
    description: 'Service booking cancelled successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel - booking already completed or cancelled.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @ApiBearerAuth('JWT-auth')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.cancel(id, req.user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('GYMOWNER', 'ADMIN', 'TRAINER')
  @Post(':id/mark-no-show')
  @ApiOperation({ summary: 'Mark a service booking as no-show' })
  @ApiResponse({ status: 200, description: 'Booking marked as no-show.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - booking not confirmed.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions.',
  })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @ApiBearerAuth('JWT-auth')
  markNoShow(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.markNoShow(id, req.user.userId);
  }
}
