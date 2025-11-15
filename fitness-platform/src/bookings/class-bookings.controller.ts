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
import { ClassBookingsService } from './class-bookings.service';
import { CreateClassBookingDto } from './dto/create-class-booking.dto';
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

@ApiTags('class-bookings')
@Controller('bookings/classes')
@UseGuards(JwtAuthGuard)
export class ClassBookingsController {
  constructor(private readonly classBookingsService: ClassBookingsService) {}

  @Get()
  @ApiOperation({ summary: "Get user's class bookings with optional filters" })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of class bookings with metadata.',
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

    return this.classBookingsService.findAll(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific class booking by ID' })
  @ApiResponse({ status: 200, description: 'Class booking details.' })
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
    return this.classBookingsService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new class booking' })
  @ApiResponse({
    status: 201,
    description: 'Class booking created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or business rule violation.',
  })
  @ApiResponse({ status: 404, description: 'Class not found.' })
  @ApiBearerAuth('JWT-auth')
  create(
    @Body() createClassBookingDto: CreateClassBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.classBookingsService.create(
      req.user.userId,
      createClassBookingDto.classId,
      createClassBookingDto.startTime
        ? new Date(createClassBookingDto.startTime)
        : undefined,
      createClassBookingDto.endTime
        ? new Date(createClassBookingDto.endTime)
        : undefined,
      createClassBookingDto.notes,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a class booking' })
  @ApiResponse({
    status: 200,
    description: 'Class booking updated successfully.',
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
    return this.classBookingsService.update(
      id,
      updateBookingDto,
      req.user.userId,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a class booking' })
  @ApiResponse({
    status: 200,
    description: 'Class booking cancelled successfully.',
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
    return this.classBookingsService.cancel(id, req.user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('GYMOWNER', 'ADMIN')
  @Post(':id/mark-no-show')
  @ApiOperation({ summary: 'Mark a class booking as no-show' })
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
    return this.classBookingsService.markNoShow(id, req.user.userId);
  }
}
