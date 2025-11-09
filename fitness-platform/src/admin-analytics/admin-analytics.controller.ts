import { Controller, Get, UseGuards} from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@Controller('admin-analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get total number of users' })
  @Get('totalusers')
  @ApiBearerAuth('JWT-auth')
  totalUsers() {
    return this.adminAnalyticsService.totalUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of users grouped by role'})
  @Get('users-by-role')
  @ApiBearerAuth('JWT-auth')
  usersByRole() {
    return this.adminAnalyticsService.usersByRole();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of users grouped by gender'})
  @Get('users-by-gender')
  @ApiBearerAuth('JWT-auth')
  usersByGender() {
    return this.adminAnalyticsService.usersByGender();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of users grouped by goal'})  
  @Get('users-by-goal')
  @ApiBearerAuth('JWT-auth')
  usersByGoal() {
    return this.adminAnalyticsService.usersByGoal();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of new users signed up grouped by day'})  
  @Get('new-users-daily')
  @ApiBearerAuth('JWT-auth')
  newUsersDaily(){
    return this.adminAnalyticsService.newUsersDaily();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of new users signed up grouped by week'})  
  @Get('new-users-weekly')
  @ApiBearerAuth('JWT-auth')
  newUsersWeekly(){
    return this.adminAnalyticsService.newUsersDaily();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get number of new users signed up grouped by month'})  
  @Get('new-users-month')
  @ApiBearerAuth('JWT-auth')
  newUsersPerMonth(){
    return this.adminAnalyticsService.newUsersPerMonth();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of active users'})  
  @Get('active-users')
  @ApiBearerAuth('JWT-auth')
  activeUsers(){
    return this.adminAnalyticsService.activeUsers();

  }
  
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of users age distribution'})  
  @Get('age-distribution')
  @ApiBearerAuth('JWT-auth')
  ageDistribution(){
    return this.adminAnalyticsService.ageDistribution();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of gyms by verification status'})  
  @Get('gym-verified')
  @ApiBearerAuth('JWT-auth')
  gymsByVerification(){
    return this.adminAnalyticsService.gymsByVerificationStatus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of gyms by number of services'})  
  @Get('gym-by-services')
  @ApiBearerAuth('JWT-auth')
  gymsByServices(){
    return this.adminAnalyticsService.gymsByServices();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of gyms by number of classes'})  
  @Get('gym-by-classes')
  @ApiBearerAuth('JWT-auth')
  gymsByClasses(){
    return this.adminAnalyticsService.gymsByClasses();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of class schedules by popularity'})  
  @Get('class-schedules')
  @ApiBearerAuth('JWT-auth')
  popularClassSchedules(){
    return this.adminAnalyticsService.popularClassSchedules();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of trainers by number of classes'})  
  @Get('trainer-classes')
  @ApiBearerAuth('JWT-auth')
  topTrainersByClasses(){
    return this.adminAnalyticsService.topTrainersByClasses();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List of class pricings'})  
  @Get('class-pricings')
  @ApiBearerAuth('JWT-auth')
  gymClassPricingInsights(){
    return this.adminAnalyticsService.gymClassPricingInsights();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Total classes per gym'})  
  @Get('total-classes-per-gym')
  @ApiBearerAuth('JWT-auth')
  totalClassesPerGym(){
    return this.adminAnalyticsService.totalClassesPerGym();
  }

}
