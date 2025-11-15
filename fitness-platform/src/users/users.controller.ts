import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  Query,
  BadRequestException,
  HttpCode,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '@prisma/client';
import { PaginationSchema, PaginationDto } from './dto/pagination.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateUsersDto } from './dto/update-users.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  @ApiOperation({ summary: 'Get paginated list of users' })
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
    name: 'gender',
    required: false,
    enum: ['MALE', 'FEMALE'],
    description: 'Gender filter',
  })
  @ApiQuery({
    name: 'goal',
    required: false,
    enum: ['WEIGHTLOSS', 'YOGA', 'BODYBUILDING'],
    description: 'Goal filter',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER'],
    description: 'Role filter',
  })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiBearerAuth('JWT-auth')
  findAll(@Query() query: any) {
    try {
      const pagination: PaginationDto = PaginationSchema.parse(query);
      return this.usersService.findAll(pagination);
    } catch {
      throw new BadRequestException('Invalid pagination parameters');
    }
  }

  // @Get(':id')
  // @ApiOperation({ summary: 'Get user by ID' })
  // @ApiResponse({ status: 200, description: 'User data' })
  // @ApiResponse({ status: 404, description: 'User not found' })
  // findOne(@Param('id') id: string) {
  //   return this.usersService.findOne(+id);
  // }

  @UseGuards(JwtAuthGuard)
  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({
    description: 'User update data (all fields optional)',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'User first name' },
        lastName: { type: 'string', description: 'User last name' },
        userName: { type: 'string', description: 'Unique username' },
        password: {
          type: 'string',
          description: 'Password (min 8 characters)',
          minLength: 8,
        },
        birthDate: {
          type: 'string',
          format: 'date-time',
          description: 'Birth date',
        },
        gender: {
          type: 'string',
          enum: ['MALE', 'FEMALE'],
          description: 'User gender',
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'Email address',
        },
        phoneNo: { type: 'string', description: 'Phone number' },
        profilePic: { type: 'string', description: 'Profile picture URL' },
        bio: { type: 'string', description: 'User bio' },
        location: { type: 'string', description: 'User location' },
        goal: {
          type: 'string',
          enum: ['WEIGHTLOSS', 'YOGA', 'BODYBUILDING'],
          description: 'Fitness goal',
        },
        role: {
          type: 'string',
          enum: ['CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER'],
          description: 'User role',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth('JWT-auth')
  update(@Body() updateUsersDto: UpdateUsersDto, @Req() req: RequestWithUser) {
    return this.usersService.update(updateUsersDto, req.user.userId);
  }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles('ADMIN')
  // @Patch(':id')
  // @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  // @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  // @ApiBody({
  //   description: 'User update data (all fields optional)',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       firstName: { type: 'string', description: 'User first name' },
  //       lastName: { type: 'string', description: 'User last name' },
  //       userName: { type: 'string', description: 'Unique username' },
  //       password: {
  //         type: 'string',
  //         description: 'Password (min 8 characters)',
  //         minLength: 8,
  //       },
  //       birthDate: {
  //         type: 'string',
  //         format: 'date-time',
  //         description: 'Birth date',
  //       },
  //       gender: {
  //         type: 'string',
  //         enum: ['MALE', 'FEMALE'],
  //         description: 'User gender',
  //       },
  //       email: {
  //         type: 'string',
  //         format: 'email',
  //         description: 'Email address',
  //       },
  //       phoneNo: { type: 'string', description: 'Phone number' },
  //       profilePic: { type: 'string', description: 'Profile picture URL' },
  //       bio: { type: 'string', description: 'User bio' },
  //       location: { type: 'string', description: 'User location' },
  //       goal: {
  //         type: 'string',
  //         enum: ['WEIGHTLOSS', 'YOGA', 'BODYBUILDING'],
  //         description: 'Fitness goal',
  //       },
  //       role: {
  //         type: 'string',
  //         enum: ['CUSTOMER', 'ADMIN', 'GYMOWNER', 'TRAINER'],
  //         description: 'User role',
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({ status: 200, description: 'User updated' })
  // @ApiResponse({ status: 404, description: 'User not found' })
  // @ApiBearerAuth('JWT-auth')
  // updateById(
  //   @Param('id', ParseIntPipe) id: number,
  //   @Body() updateUsersDto: UpdateUsersDto,
  // ) {
  //   return this.usersService.update(updateUsersDto, id);
  // }

  @UseGuards(JwtAuthGuard)
  @Delete()
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(204)
  async remove(@Req() req: RequestWithUser) {
    await this.usersService.remove(req.user.userId);
  }
}