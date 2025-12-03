import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Role, Goal } from '@prisma/client';
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
  private googleTempStore = new Map<string, any>();

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

    return {
      user: {
        userId: registeredUser.userId,
        email: registeredUser.email,
        phoneNo: registeredUser.phoneNo,
        firstName: registeredUser.firstName,
        lastName: registeredUser.lastName,
        userName: registeredUser.userName,
        birthDate: registeredUser.birthDate,
        location: registeredUser.location,
        bio: registeredUser.bio,
        profilePic: registeredUser.profilePic,
        role: registeredUser.role,
        gender: registeredUser.gender,
        goal: registeredUser.goal,
      },
      message: 'Registration successful',
    };
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

    await this.db.user.update({
      where: {
        userId: user!.userId,
      },
      data: {
        lastLogin: new Date(),
      },
    });

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

  async validateGoogleUser(profile: any) {
      const { id: googleId, emails, displayName } = profile;
      const email = emails?.[0]?.value;

      // Phase 1: Check if already linked
      const googleLinkedUser = await this.db.user.findUnique({
        where: { googleId },
      });
      if (googleLinkedUser) return googleLinkedUser;

      // Phase 2: Check if email matches existing account
      if (email) {
        const existingByEmail = await this.db.user.findUnique({
          where: { email },
        });
        if (existingByEmail) {
          // Link Google account
          return await this.db.user.update({
            where: { email },
            data: {
              googleId,
              isGoogleUser: true,
            },
          });
        }
      }

      // Phase 3: No email match — frontend must ask for phone number
      return {
        requiresPhone: true,
        googleData: { googleId, email, name: displayName },
      };
  }

  async registerOrLinkGoogleUser(dto: {phoneNo: string; gender: Gender; goal: Goal; googleData: any; role: Role; birthDate: Date, location?: string; bio?: string; profilePic?: string; userName?: string;}) {
      const existingByPhone = await this.db.user.findUnique({
        where: { phoneNo: dto.phoneNo },
      });
      // User with this phone already exists -> Link Google account
      if (existingByPhone) {
        return await this.db.user.update({
          where: { phoneNo: dto.phoneNo },
          data: {
            googleId: dto.googleData.googleId,
            // Only update email if it doesn't exist
            email: existingByPhone.email ?? dto.googleData.email, 
            isGoogleUser: true,
          },
        });
      }

      // No user with this phone -> Create a new user
      return await this.db.user.create({
        data: {
          phoneNo: dto.phoneNo,
          email: dto.googleData.email,
          firstName: dto.googleData.name.split(" ")[0] || '',
          lastName: dto.googleData.name.split(" ")[1] || '',
          userName: dto.googleData.name?.givenName || 'GoogleUser',
          location: dto.location || '',
          bio: dto.bio || '',
          profilePic: dto.googleData.photos?.[0]?.value || '',
          birthDate: new Date(dto.birthDate),
          gender: dto.gender,
          goal: dto.goal,
          googleId: dto.googleData.googleId,
          isGoogleUser: true,
          role: dto.role || 'CUSTOMER',
        },
      });
  }
  async generateJwt(user: any) {
      const payload = { 
        sub: user.userId, 
        email: user.email, 
        phoneNo: user.phoneNo,
        role: user.role 
      };
    return this.jwtService.sign(payload);
}

createTempSession(googleData: any): string {
    const sessionId = crypto.randomUUID();
    this.googleTempStore.set(sessionId, googleData);
    setTimeout(() => this.googleTempStore.delete(sessionId), 5 * 60 * 1000); 
    return sessionId;
}

getTempSession(sessionId: string): any {
    return this.googleTempStore.get(sessionId);
}

clearTempSession(sessionId: string) {
    this.googleTempStore.delete(sessionId);
}

}