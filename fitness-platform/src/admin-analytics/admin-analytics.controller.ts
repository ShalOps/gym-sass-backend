import {
  Controller,
  Get,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';

@Controller('admin-analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retrieve the total count of all users' })
  @Get('totalusers')
  @ApiBearerAuth('JWT-auth')
  totalUsers() {
    return this.adminAnalyticsService.totalUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retrieve user counts grouped by role' })
  @Get('users-by-role')
  @ApiBearerAuth('JWT-auth')
  usersByRole() {
    return this.adminAnalyticsService.usersByRole();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retrieve user counts grouped by gender' })
  @Get('users-by-gender')
  @ApiBearerAuth('JWT-auth')
  usersByGender() {
    return this.adminAnalyticsService.usersByGender();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retrieve user counts grouped by fitness goal' })
  @Get('users-by-goal')
  @ApiBearerAuth('JWT-auth')
  usersByGoal() {
    return this.adminAnalyticsService.usersByGoal();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retrieve daily new user sign-up counts over the last 30 days',
  })
  @Get('new-users-daily')
  @ApiBearerAuth('JWT-auth')
  newUsersDaily() {
    return this.adminAnalyticsService.newUsersDaily();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retrieve weekly new user sign-up counts over the last 90 days',
  })
  @Get('new-users-weekly')
  @ApiBearerAuth('JWT-auth')
  newUsersWeekly() {
    return this.adminAnalyticsService.newUsersWeekly();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retrieve monthly new user sign-up counts over the last year',
  })
  @Get('new-users-month')
  @ApiBearerAuth('JWT-auth')
  newUsersPerMonth() {
    return this.adminAnalyticsService.newUsersPerMonth();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve the count of active users (users who logged in within the last 30 days)',
  })
  @Get('active-users')
  @ApiBearerAuth('JWT-auth')
  activeUsers() {
    return this.adminAnalyticsService.activeUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retrieve user counts grouped by age distribution ranges',
  })
  @Get('age-distribution')
  @ApiBearerAuth('JWT-auth')
  ageDistribution() {
    return this.adminAnalyticsService.ageDistribution();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve gym counts by verification status (total, verified, unverified)',
  })
  @Get('gym-verified')
  @ApiBearerAuth('JWT-auth')
  gymsByVerification() {
    return this.adminAnalyticsService.gymsByVerificationStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve top gyms by number of services offered (with optional limit and date range filter)',
  })
  @Get('gym-by-services')
  @ApiBearerAuth('JWT-auth')
  gymsByServices(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymsByServices(
      query.limit,
      query.from,
      query.to,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve top gyms by number of classes offered (with optional limit and date range filter)',
  })
  @Get('gym-by-classes')
  @ApiBearerAuth('JWT-auth')
  gymsByClasses(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymsByClasses(
      query.limit,
      query.from,
      query.to,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve top class schedules by number of classes (sorted by popularity, with optional limit and date range filter)',
  })
  @Get('class-schedules')
  @ApiBearerAuth('JWT-auth')
  popularClassSchedules(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.popularClassSchedules(
      query.limit,
      query.from,
      query.to,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve top trainers by number of classes taught (with optional limit and date range filter)',
  })
  @Get('trainer-classes')
  @ApiBearerAuth('JWT-auth')
  topTrainersByClasses(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.topTrainersByClasses(
      query.limit,
      query.from,
      query.to,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve per-gym insights of average class price (with optional limit and date range filter)',
  })
  @Get('class-pricings')
  @ApiBearerAuth('JWT-auth')
  gymClassPricingInsights(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymClassPricingInsights(
      query.limit,
      query.from,
      query.to,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Retrieve total revenue analytics (with optional date range filter)',
  })
  @Get('revenue')
  @ApiBearerAuth('JWT-auth')
  getRevenueAnalytics(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.getRevenueAnalytics(query.from, query.to);
  }
}
