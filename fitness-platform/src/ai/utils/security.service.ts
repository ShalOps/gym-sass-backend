import { Injectable } from '@nestjs/common';
import validator from 'validator';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';

// Create a DOMPurify instance
//eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const jsdom = new JSDOM('');
const DOMPurifyInstance = DOMPurify(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
   * Anonymizes user ID for AI prompts (optional additional layer)
   */
  anonymizeUserId(userId: string | number): string {
    // Simple hash for anonymization - in production, use proper hashing
    const hash: string = crypto
      .createHash('sha256')
      .update(String(userId))
      .digest('hex');
    return hash.substring(0, 16); // First 16 chars of hash
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
