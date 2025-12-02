import { BadRequestException } from '@nestjs/common';

export class DateUtil {
  /**
   * Formats a UTC date to a specific timezone string
   * @param date The date to format
   * @param timezone The IANA timezone identifier (e.g., 'Africa/Addis_Ababa')
   * @param locale The locale to use for formatting (default: 'en-US')
   * @returns Formatted date string (e.g., "Monday, Oct 27, 10:00 AM")
   */
  static formatInTimezone(
    date: Date,
    timezone: string,
    locale: string = 'en-US',
  ): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZone: timezone,
        timeZoneName: 'short',
      }).format(date);
    } catch {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  /**
   * Validates if a string is a valid IANA timezone
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
