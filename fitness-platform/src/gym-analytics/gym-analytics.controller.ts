import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { GymAnalyticsService } from "./gym-analytics.service";
import { DateRangeDto } from "./dto/date-range.dto";
import { BookingStatsQueryDto } from "./dto/booking-stats.dto";
import { UserActivityParamsDto } from "./dto/user-activity.dto";

@Controller('analytics')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GymAnalyticsController {
  constructor(private gymAnalyticsService: GymAnalyticsService) {}


  @Get('gyms/:gymId/bookings/total')
  async totalBookingsForGym(
    @Param('gymId') gymId: string,
    @Query() dateRange: DateRangeDto,
  ) {
    return this.gymAnalyticsService.totalBookingsForGym(
        gymId,
        dateRange.startDate,
        dateRange.endDate
    );
  }
   @Get('bookings/stats')
    async bookingCounts(@Query() q: BookingStatsQueryDto) {
        return this.gymAnalyticsService.bookingCounts(q);
    }

    @Get('users/:userId/activity')
      async userActivity(@Param() params: UserActivityParamsDto, @Query() dateRange: DateRangeDto) {
        return this.gymAnalyticsService.userActivity(params.userId, dateRange.startDate, dateRange.endDate);
    }

    

}