// auth.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { JwtStrategy } from './guards/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    ConfigModule, // <-- Make sure ConfigModule is imported
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error(
            'FATAL: JWT_SECRET is missing from environment variables.',
          );
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '7d' }, // <-- Set expiration here
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy, // <-- Add Strategy to providers
    JwtAuthGuard, // <-- Add Guard to providers
    RolesGuard, // <-- Add RolesGuard to providers
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard], // <-- Export guards
})
export class AuthModule {}
