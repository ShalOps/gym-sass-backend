import { Injectable } from '@nestjs/common';
import validator from 'validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';
import { Logger } from '@nestjs/common';

// Create a DOMPurify instance
const jsdom = new JSDOM('');
const DOMPurifyInstance = DOMPurify(
  jsdom.window as unknown as Parameters<typeof DOMPurify>[0],
);

@Injectable()
export class SecurityService {
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = validator.escape(input);

    sanitized = DOMPurifyInstance.sanitize(sanitized, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
    });

    return sanitized.trim();
  }

  validateAndSanitizeMessage(message: string): {
    isValid: boolean;
    sanitizedMessage: string;
    error?: string;
  } {
    if (!message || typeof message !== 'string') {
      return {
        isValid: false,
        sanitizedMessage: '',
        error: 'Message is required',
      };
    }

    if (message.length > 2000) {
      return {
        isValid: false,
        sanitizedMessage: '',
        error: 'Message too long (max 2000 characters)',
      };
    }

    if (message.length < 1) {
      return {
        isValid: false,
        sanitizedMessage: '',
        error: 'Message cannot be empty',
      };
    }

    const sanitized = this.sanitizeInput(message);

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(sanitized)) {
      return {
        isValid: false,
        sanitizedMessage: '',
        error: 'Message contains invalid content',
      };
    }

    return { isValid: true, sanitizedMessage: sanitized };
  }

  /**
   * Minimizes user data sent to AI prompts for privacy
   */
  minimizeUserDataForAI(
    userData:
      | {
          userId?: string | number;
          fitnessLevel?: string;
          goals?: string;
          preferredTimes?: string;
          preferredLocations?: string;
          classTypes?: string;
          priceRange?: string;
          equipmentAtHome?: string;
          // Add other fields as needed
        }
      | null
      | undefined,
  ): Record<string, unknown> {
    if (!userData) return {};

    // Only include necessary, non-sensitive fields for AI personalization
    const minimized: Record<string, unknown> = {
      userId: userData?.userId,
      fitnessLevel: userData?.fitnessLevel,
      goals: userData?.goals,
      preferredTimes: userData?.preferredTimes,
      preferredLocations: userData?.preferredLocations,
      classTypes: userData?.classTypes,
      priceRange: userData?.priceRange,
      equipmentAtHome: userData?.equipmentAtHome,
      // Exclude sensitive data: healthNotes, injuries, full personal info
    };

    // Remove null/undefined values
    Object.keys(minimized).forEach((key) => {
      if (minimized[key] === null || minimized[key] === undefined) {
        delete minimized[key];
      }
    });

    return minimized;
  }

  /**
   * Anonymizes user ID for AI prompts using HMAC-SHA256 with salt
   */
  anonymizeUserId(userId: string | number): string {
    const salt = process.env.ANONYMIZATION_SALT;
    if (typeof salt !== 'string' || !salt) {
      Logger.warn(
        'ANONYMIZATION_SALT environment variable is not set. Using random salt for development. Set ANONYMIZATION_SALT in production.',
        'SecurityService',
      );
      // Generate a random salt for development - this changes on each restart
      const randomSalt = crypto.randomBytes(32).toString('hex');
      const hmac = crypto.createHmac('sha256', randomSalt);
      hmac.update(String(userId));
      return hmac.digest('hex');
    }

    // Use HMAC-SHA256 for keyed hashing to prevent rainbow table attacks
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(String(userId));
    const hash = hmac.digest('hex');

    // Return full hash for maximum security
    return hash;
  }

  /**
   * Checks for suspicious patterns in input
   */
  private containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /data:text\/html/i,
      /vbscript:/i,
      /expression\s*\(/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Validates file uploads for AI-related content (if needed)
   */
  validateFileUpload(
    file: { size?: number; mimetype?: unknown } | null | undefined,
  ): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    // Check file size (max 5MB for AI processing)
    const maxSize = 5 * 1024 * 1024;
    if (typeof file.size !== 'number' || file.size > maxSize) {
      return { isValid: false, error: 'File too large (max 5MB)' };
    }

    // Check file type (only images for now)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const mimetype = file.mimetype;
    if (typeof mimetype !== 'string' || !allowedTypes.includes(mimetype)) {
      return {
        isValid: false,
        error: 'Invalid file type (only JPEG, PNG, GIF allowed)',
      };
    }

    return { isValid: true };
  }
}
