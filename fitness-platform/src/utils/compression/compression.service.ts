import { Injectable } from '@nestjs/common';
import * as zlib from 'zlib';

@Injectable()
export class CompressionService {
  compress(data: string): Buffer {
    if (!data) return Buffer.from('');
    return zlib.gzipSync(Buffer.from(data, 'utf8'));
  }

  decompress(compressedData: Buffer): string {
    if (!compressedData || compressedData.length === 0) return '';
    return zlib.gunzipSync(compressedData).toString('utf8');
  }
}
