import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly secretKey = process.env.ENCRYPTION_KEY!;

  encrypt(message: string): string {
    if (!message) return message;
    return CryptoJS.AES.encrypt(message, this.secretKey).toString();
  }

  decrypt(encryptedMessage: string): string {
    if (!encryptedMessage) return encryptedMessage;
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, this.secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      // Return original if decryption fails (e.g. not encrypted)
      return encryptedMessage;
    }
  }
}
