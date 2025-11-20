import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ChapaService } from 'chapa-nestjs';

@Injectable()
export class PaymentService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly chapaService: ChapaService,
  ) {}
}
