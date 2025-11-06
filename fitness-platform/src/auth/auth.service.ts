import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role, Gender, Goal } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.password.length || dto.password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const gender = dto.gender;
    const goal = dto.goal as Goal;

    const role: Role = dto.role || Role.CUSTOMER;
    // check if the email and the phone number is unique
    const queryClauses: ({ phoneNo: string } | { email: string })[] = [
      { phoneNo: dto.phoneNo },
    ];

    if (dto.email) {
      queryClauses.push({ email: dto.email });
    }

    const existingUser = await this.db.user.findFirst({
      where: { OR: queryClauses },
    });

    if (existingUser) {
      throw new ConflictException('Email or phone number already in use');
    }

    const registeredUser = await this.db.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        userName: dto.userName,
        email: dto.email,
        phoneNo: dto.phoneNo,
        location: dto.location,
        bio: dto.bio,
        profilePic: dto.profilePic,
        password: hashedPassword,
        birthDate: new Date(dto.birthDate),
        role: role,
        gender: gender,
        goal: goal,
      },
    });
    return { message: 'User registered successfully' };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phoneNo) {
      throw new BadRequestException('Enter email or phone number to login');
    }
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const user = dto.email
      ? await this.db.user.findUnique({ where: { email: dto.email } })
      : await this.db.user.findUnique({ where: { phoneNo: dto.phoneNo! } });

    if (dto.email && !user) {
      throw new NotFoundException('Invalid email credentials');
    } else if (dto.phoneNo && !user) {
      throw new NotFoundException('Invalid phone number credentials');
    }

    const isPasswordMatch = await bcrypt.compare(dto.password, user!.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid password credentials');
    }

    const payload = {
      sub: user!.userId,
      role: user!.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
  async getProfile(userId: number) {
    const user = await this.db.user.findUnique({
      where: { userId: userId },
      select: {
        userId: true,
        email: true,
        phoneNo: true,
        firstName: true,
        lastName: true,
        userName: true,
        birthDate: true,
        location: true,
        bio: true,
        profilePic: true,
        role: true,
        gender: true,
        goal: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
