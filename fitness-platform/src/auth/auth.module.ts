import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthLibraryModule } from '@thallesp/nestjs-better-auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';


@Module({
  imports: [
    DatabaseModule,
    BetterAuthLibraryModule.forRootAsync({
      imports: [ConfigModule], 
      useFactory: (configService: ConfigService) => {

        const databaseUrl = configService.get<string>('DATABASE_URL');
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!databaseUrl || !jwtSecret) {
          throw new Error('FATAL: DATABASE_URL or JWT_SECRET is missing from environment variables.');
        }

        return {
          auth: {
            options: {}, 
            
            database: {
              provider: 'prisma',
              url: databaseUrl, 
            },
            tokens: {
              jwt: {
                secret: jwtSecret,
                expiresIn: '7d',
              },
            },
            adapter: {
              prisma: {
                userModel: 'user',
              },
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController], 
})
export class AuthModule {}