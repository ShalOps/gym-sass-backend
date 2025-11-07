import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    this.logger.log('Attempting to connect to the database...');

    try {
      await this.$connect();
      this.logger.log('Successfully connected to the database.');
    } catch (error: any) {
      this.logger.error(
        'Database connection failed during module initialization.',
        (error as Error).message,
        (error as Error).stack,
      );

      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Disconnected.');
  }
}
