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
} from '@nestjs/common';
import { UsersService } from './users.service';
// import { Prisma } from '@prisma/client';
import { Prisma } from '../../generated/prisma';
import { PaginationSchema, PaginationDto } from './dto/pagination.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({
    description: 'User creation data',
    schema: {
      type: 'object',
      required: [
        'firstName',
        'lastName',
        'userName',
        'password',
        'birthDate',
        'gender',
        'phoneNo',
        'location',
      ],
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
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createUserDto: Prisma.UserCreateInput) {
    return this.usersService.create(createUserDto);
  }
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
  findAll(@Query() query: any) {
    try {
      const pagination: PaginationDto = PaginationSchema.parse(query);
      return this.usersService.findAll(pagination);
    } catch {
      throw new BadRequestException('Invalid pagination parameters');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
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
  update(
    @Param('id') id: string,
    @Body() updateUserDto: Prisma.UserUpdateInput,
  ) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
