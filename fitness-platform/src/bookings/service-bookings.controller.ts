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

@Controller('bookings/services')
@UseGuards(JwtAuthGuard)
export class ServiceBookingsController {
  constructor(
    private readonly serviceBookingsService: ServiceBookingsService,
  ) {}

  @Get()
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
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.findOne(id, req.user.userId);
  }

  @Post()
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
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.serviceBookingsService.cancel(id, req.user.userId);
  }
}
