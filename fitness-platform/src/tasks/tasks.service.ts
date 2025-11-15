import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { BookingStatus } from '@prisma/client';
// import { readdir, unlink } from 'fs/promises';
// import { stat } from 'fs/promises';
// import { join } from 'path';
// import {
//   UPLOADS_DIR_ABSOLUTE,
//   THUMBNAIL_DIR_ABSOLUTE,
//   UPLOADS_WEB_PREFIX,
//   THUMBNAIL_WEB_PREFIX,
// } from '../config/paths.config';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Runs daily at 2 AM to auto-complete past bookings
   * This prevents the performance issue of running this on every list request
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoCompletePastBookings() {
    try {
      this.logger.log('Starting auto-completion of past bookings...');

      const now = new Date();
      let classBookingsUpdated = 0;
      let serviceBookingsUpdated = 0;

      // Auto-complete class bookings
      const classResult = await this.databaseService.classBooking.updateMany({
        where: {
          status: BookingStatus.CONFIRMED,
          endTime: {
            lt: now,
          },
        },
        data: {
          status: BookingStatus.COMPLETED,
        },
      });
      classBookingsUpdated = classResult.count;

      // Auto-complete service bookings
      const serviceResult =
        await this.databaseService.serviceBooking.updateMany({
          where: {
            status: BookingStatus.CONFIRMED,
            endTime: {
              lt: now,
            },
          },
          data: {
            status: BookingStatus.COMPLETED,
          },
        });
      serviceBookingsUpdated = serviceResult.count;

      this.logger.log(
        `Auto-completed ${classBookingsUpdated} class bookings and ${serviceBookingsUpdated} service bookings`,
      );
    } catch (error) {
      this.logger.error('Failed to auto-complete past bookings', error);
    }
  }

  /**
   * Runs daily at 1 AM to clean up orphaned uploaded files
   * Prevents storage bloat by removing files not referenced in database
   */
  //   @Cron(CronExpression.EVERY_DAY_AT_1AM)
  //   async cleanupOrphanedFiles() {
  //     try {
  //       this.logger.log('Starting orphaned file cleanup...');

  //       let deletedFiles = 0;
  //       let deletedThumbnails = 0;

  //       // Get all referenced file URLs from database
  //       const [photoUrls, profilePicUrls] = await Promise.all([
  //         this.databaseService.photo.findMany({
  //           select: { url: true, thumbnailUrl: true },
  //         }),
  //         this.databaseService.user.findMany({
  //           where: { profilePic: { not: null } },
  //           select: { profilePic: true },
  //         }),
  //       ]);

  //       // Create sets of referenced files for fast lookup
  //       const referencedFiles = new Set<string>();
  //       const referencedThumbnails = new Set<string>();

  //       // Add photo URLs (convert web paths to filenames)
  //       photoUrls.forEach((photo) => {
  //         if (photo.url) {
  //           const filename = photo.url.replace(UPLOADS_WEB_PREFIX, '');
  //           referencedFiles.add(filename);
  //         }
  //         if (photo.thumbnailUrl) {
  //           const thumbnailFilename = photo.thumbnailUrl.replace(
  //             THUMBNAIL_WEB_PREFIX,
  //             '',
  //           );
  //           referencedThumbnails.add(thumbnailFilename);
  //         }
  //       });

  //       // Add profile picture URLs
  //       profilePicUrls.forEach((user) => {
  //         if (user.profilePic) {
  //           const filename = user.profilePic.replace(UPLOADS_WEB_PREFIX, '');
  //           referencedFiles.add(filename);
  //         }
  //       });

  //       // Check uploads directory
  //       try {
  //         const uploadFiles = await readdir(UPLOADS_DIR_ABSOLUTE);
  //         for (const file of uploadFiles) {
  //           // Skip directories and hidden files
  //           if (file.startsWith('.') || file === 'temp') continue;

  //           if (!referencedFiles.has(file)) {
  //             try {
  //               const filePath = join(UPLOADS_DIR_ABSOLUTE, file);
  //               await stat(filePath); // Check if file exists
  //               await unlink(filePath);
  //               deletedFiles++;
  //               this.logger.debug(`Deleted orphaned file: ${file}`);
  //             } catch (error) {
  //               this.logger.warn(
  //                 `Failed to delete orphaned file ${file}:`,
  //                 error,
  //               );
  //             }
  //           }
  //         }
  //       } catch (error) {
  //         this.logger.error('Failed to read uploads directory:', error);
  //       }

  //       // Check thumbnails directory
  //       try {
  //         const thumbnailFiles = await readdir(THUMBNAIL_DIR_ABSOLUTE);
  //         for (const file of thumbnailFiles) {
  //           // Skip directories and hidden files
  //           if (file.startsWith('.')) continue;

  //           if (!referencedThumbnails.has(file)) {
  //             try {
  //               const filePath = join(THUMBNAIL_DIR_ABSOLUTE, file);
  //               await stat(filePath); // Check if file exists
  //               await unlink(filePath);
  //               deletedThumbnails++;
  //               this.logger.debug(`Deleted orphaned thumbnail: ${file}`);
  //             } catch (error) {
  //               this.logger.warn(
  //                 `Failed to delete orphaned thumbnail ${file}:`,
  //                 error,
  //               );
  //             }
  //           }
  //         }
  //       } catch (error) {
  //         this.logger.error('Failed to read thumbnails directory:', error);
  //       }

  //       this.logger.log(
  //         `Orphaned file cleanup completed. Deleted ${deletedFiles} files and ${deletedThumbnails} thumbnails`,
  //       );
  //     } catch (error) {
  //       this.logger.error('Failed to cleanup orphaned files', error);
  //     }
  //   }
  //   @Cron('0 */4 * * *')
  //   async cleanupTempFiles() {
  //     try {
  //       this.logger.log('Starting temporary file cleanup...');

  //       const now = Date.now();
  //       const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  //       let deletedFiles = 0;

  //       // Get all referenced file URLs to avoid deleting active files
  //       const [photoUrls, profilePicUrls] = await Promise.all([
  //         this.databaseService.photo.findMany({
  //           select: { url: true },
  //         }),
  //         this.databaseService.user.findMany({
  //           where: { profilePic: { not: null } },
  //           select: { profilePic: true },
  //         }),
  //       ]);

  //       // Create set of referenced filenames for fast lookup
  //       const referencedFiles = new Set<string>();

  //       photoUrls.forEach((photo) => {
  //         if (photo.url) {
  //           const filename = photo.url.replace(UPLOADS_WEB_PREFIX, '');
  //           referencedFiles.add(filename);
  //         }
  //       });

  //       profilePicUrls.forEach((user) => {
  //         if (user.profilePic) {
  //           const filename = user.profilePic.replace(UPLOADS_WEB_PREFIX, '');
  //           referencedFiles.add(filename);
  //         }
  //       });

  //       // Check uploads directory for old files
  //       try {
  //         const files = await readdir(UPLOADS_DIR_ABSOLUTE);

  //         for (const file of files) {
  //           // Skip directories and hidden files
  //           if (file.startsWith('.') || file === 'temp' || file === 'thumbnails')
  //             continue;

  //           // Skip files that are still referenced
  //           if (referencedFiles.has(file)) continue;

  //           try {
  //             const filePath = join(UPLOADS_DIR_ABSOLUTE, file);
  //             const stats = await stat(filePath);

  //             // Check if file is older than 24 hours
  //             if (now - stats.mtime.getTime() > maxAge) {
  //               await unlink(filePath);
  //               deletedFiles++;
  //               this.logger.debug(`Deleted old temp file: ${file}`);
  //             }
  //           } catch (error) {
  //             this.logger.warn(
  //               `Failed to check/delete temp file ${file}:`,
  //               error,
  //             );
  //           }
  //         }
  //       } catch (error) {
  //         this.logger.error('Failed to read uploads directory:', error);
  //       }

  //       this.logger.log(
  //         `Temporary file cleanup completed. Deleted ${deletedFiles} old files`,
  //       );
  //     } catch (error) {
  //       this.logger.error('Failed to cleanup temporary files', error);
  //     }
  //   }
}
