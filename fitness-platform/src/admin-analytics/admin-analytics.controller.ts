import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import {
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';

@ApiTags('Admin Analytics')
@Controller('admin-analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
@ApiResponse({ status: 403, description: 'Forbidden. Admin access required.' })
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @ApiOperation({ summary: 'Retrieve the total count of all users' })
  @ApiResponse({
    status: 200,
    description: 'Total number of users retrieved successfully.',
  })
  @Get('totalusers')
  totalUsers() {
    return this.adminAnalyticsService.totalUsers();
  }

  @ApiOperation({ summary: 'Retrieve user counts grouped by role' })
  @ApiResponse({
    status: 200,
    description: 'User counts by role retrieved successfully.',
  })
  @Get('users-by-role')
  usersByRole() {
    return this.adminAnalyticsService.usersByRole();
  }

  @ApiOperation({ summary: 'Retrieve user counts grouped by gender' })
  @ApiResponse({
    status: 200,
    description: 'User counts by gender retrieved successfully.',
  })
  @Get('users-by-gender')
  usersByGender() {
    return this.adminAnalyticsService.usersByGender();
  }

  @ApiOperation({ summary: 'Retrieve user counts grouped by fitness goal' })
  @ApiResponse({
    status: 200,
    description: 'User counts by fitness goal retrieved successfully.',
  })
  @Get('users-by-goal')
  usersByGoal() {
    return this.adminAnalyticsService.usersByGoal();
  }

  @ApiOperation({
    summary: 'Retrieve daily new user sign-up counts over the last 30 days',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily new user sign-up counts retrieved successfully.',
  })
  @Get('new-users-daily')
  newUsersDaily() {
    return this.adminAnalyticsService.newUsersDaily();
  }

  @ApiOperation({
    summary: 'Retrieve weekly new user sign-up counts over the last 90 days',
  })
  @ApiResponse({
    status: 200,
    description: 'Weekly new user sign-up counts retrieved successfully.',
  })
  @Get('new-users-weekly')
  newUsersWeekly() {
    return this.adminAnalyticsService.newUsersWeekly();
  }

  @ApiOperation({
    summary: 'Retrieve monthly new user sign-up counts over the last year',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly new user sign-up counts retrieved successfully.',
  })
  @Get('new-users-month')
  newUsersPerMonth() {
    return this.adminAnalyticsService.newUsersPerMonth();
  }

  @ApiOperation({
    summary:
      'Retrieve the count of active users (users who logged in within the last 30 days)',
  })
  @ApiResponse({
    status: 200,
    description: 'Active users count retrieved successfully.',
  })
  @Get('active-users')
  activeUsers() {
    return this.adminAnalyticsService.activeUsers();
  }

  @ApiOperation({
    summary: 'Retrieve user counts grouped by age distribution ranges',
  })
  @ApiResponse({
    status: 200,
    description: 'User age distribution retrieved successfully.',
  })
  @Get('age-distribution')
  ageDistribution() {
    return this.adminAnalyticsService.ageDistribution();
  }

  @ApiOperation({
    summary:
      'Retrieve gym counts by verification status (total, verified, unverified)',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym counts by verification status retrieved successfully.',
  })
  @Get('gym-verified')
  gymsByVerification() {
    return this.adminAnalyticsService.gymsByVerificationStatus();
  }

  @ApiOperation({
    summary:
      'Retrieve top gyms by number of services offered (with optional limit and date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top gyms by services retrieved successfully.',
  })
  @Get('gym-by-services')
  gymsByServices(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymsByServices(
      query.limit,
      query.from,
      query.to,
    );
  }

  @ApiOperation({
    summary:
      'Retrieve top gyms by number of classes offered (with optional limit and date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top gyms by classes retrieved successfully.',
  })
  @Get('gym-by-classes')
  gymsByClasses(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymsByClasses(
      query.limit,
      query.from,
      query.to,
    );
  }

  @ApiOperation({
    summary:
      'Retrieve top class schedules by number of classes (sorted by popularity, with optional limit and date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular class schedules retrieved successfully.',
  })
  @Get('class-schedules')
  popularClassSchedules(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.popularClassSchedules(
      query.limit,
      query.from,
      query.to,
    );
  }

  @ApiOperation({
    summary:
      'Retrieve top trainers by number of classes taught (with optional limit and date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top trainers by classes taught retrieved successfully.',
  })
  @Get('trainer-classes')
  topTrainersByClasses(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.topTrainersByClasses(
      query.limit,
      query.from,
      query.to,
    );
  }

  @ApiOperation({
    summary:
      'Retrieve per-gym insights of average class price (with optional limit and date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym class pricing insights retrieved successfully.',
  })
  @Get('class-pricings')
  gymClassPricingInsights(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.gymClassPricingInsights(
      query.limit,
      query.from,
      query.to,
    );
  }

  @ApiOperation({
    summary:
      'Retrieve total revenue analytics (with optional date range filter)',
  })
  @ApiResponse({
    status: 200,
    description: 'Revenue analytics retrieved successfully.',
  })
  @Get('revenue')
  getRevenueAnalytics(@Query() query: AdminAnalyticsQueryDto) {
    return this.adminAnalyticsService.getRevenueAnalytics(query.from, query.to);
  }
}
