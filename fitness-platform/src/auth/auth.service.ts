import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role, Gender, Goal } from '../../generated/prisma';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
declare const auth: any; 


@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const gender = dto.gender as Gender;
    const goal = dto.goal as Goal;

    let userRole: Role = Role.CUSTOMER; 
    return this.db.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        birthDate: new Date(dto.birthDate),
        role: userRole,
        gender: gender,
        goal: goal,
      },
    });
  }

  async login(dto: LoginDto) {
    try {
    
      const response = await auth.api.signInEmail({
        body: {
          email: dto.email,
          password: dto.password,
        },
        asResponse: true,
      });
      const token =
        response.headers.get('set-auth-token') ||
        response.headers.get('set-auth-jwt');

      if (!token) {
        throw new Error('Login succeeded but no token was provided.');
      }

      return { accessToken: token };
      
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}