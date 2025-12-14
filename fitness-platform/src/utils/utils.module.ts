import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { CompressionService } from './compression/compression.service';

@Module({
  providers: [EncryptionService, CompressionService],
  exports: [EncryptionService, CompressionService],
})
export class UtilsModule {}
