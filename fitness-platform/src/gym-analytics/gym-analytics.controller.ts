import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { GymAnalyticsService } from "./gym-analytics.service";
import { DateRangeDto } from "./dto/date-range.dto";

@Controller('analytics')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GymAnalyticsController {
    constructor(private gymAnalyticsService: GymAnalyticsService) {}


    @Get('bookings/total')
  getTotalBookings(@Query() query: DateRangeDto) {
    return this.gymAnalyticsService.getTotalBookings(query);
  }
   @Get('bookings/monthly')
  getMonthlyBookings(@Query() query: DateRangeDto) {
    return this.gymAnalyticsService.getMonthlyBookings(query);
  }
  @Get('users/activity')
    getUserActivity(@Query() query: DateRangeDto) {
      return this.gymAnalyticsService.getUserActivity();
  }

  @Get('revenue')
    getRevenueStats(@Query() query: DateRangeDto) {
      return this.gymAnalyticsService.getRevenueStats(query);
  }
}