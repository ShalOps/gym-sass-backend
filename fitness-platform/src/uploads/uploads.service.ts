import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { unlink } from 'fs/promises';
import { mkdir } from 'fs/promises';
import sharp from 'sharp';
import { Photo } from '@prisma/client';

@Injectable()
export class UploadsService {
  constructor(private readonly db: DatabaseService) {}

  private async generateThumbnails(photos: Photo[]): Promise<void> {
    const thumbnailPromises = photos.map(async (photo) => {
      const originalPath = `.${photo.url}`;
      const filename = photo.url.split('/').pop();
      const thumbnailDir = process.env.THUMBNAIL_DIR || './uploads/thumbnails';
      const thumbnailPath = `/${thumbnailDir.replace('./', '')}/${filename}`;

      try {
        await sharp(originalPath)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(`.${thumbnailPath}`);

        await this.db.photo.update({
          where: { id: photo.id },
          data: { thumbnailUrl: thumbnailPath },
        });
      } catch (error) {
        console.warn(`Failed to generate thumbnail for ${photo.url}:`, error);
        // Continue without thumbnail
      }
    });

    await Promise.all(thumbnailPromises);
  }

  private async createPhotos(
    entityType: 'GYM' | 'CLASS',
    entityId: number,
    filePaths: string[],
    coverIndex?: number,
    orders?: number[],
  ): Promise<Photo[]> {
    return this.db.$transaction(async (tx) => {
      // Reset existing cover if setting a new one
      if (coverIndex !== undefined) {
        await tx.photo.updateMany({
          where: { entityType, entityId },
          data: { isCover: false },
        });
      }

      const createdPhotos: Photo[] = [];
      for (let i = 0; i < filePaths.length; i++) {
        const photo = await tx.photo.create({
          data: {
            url: filePaths[i],
            entityType,
            entityId,
            isCover: coverIndex !== undefined && i === coverIndex,
            order: orders ? orders[i] : i + 1,
          },
        });
        createdPhotos.push(photo);
      }

      // Update entity coverPhotoId if coverIndex provided
      if (coverIndex !== undefined && createdPhotos[coverIndex]) {
        const updateData = { coverPhotoId: createdPhotos[coverIndex].id };
        if (entityType === 'GYM') {
          await tx.gym.update({
            where: { gymId: entityId },
            data: updateData,
          });
        } else {
          await tx.gymClasses.update({
            where: { classId: entityId },
            data: updateData,
          });
        }
      }

      return createdPhotos;
    });
  }

  private async deletePhotoFiles(photo: {
    url: string;
    thumbnailUrl?: string | null;
  }): Promise<void> {
    try {
      await unlink(`.${photo.url}`);
    } catch (error) {
      console.warn(`Failed to delete file: ${photo.url}`, error);
    }

    if (photo.thumbnailUrl) {
      try {
        await unlink(`.${photo.thumbnailUrl}`);
      } catch (error) {
        console.warn(
          `Failed to delete thumbnail: ${photo.thumbnailUrl}`,
          error,
        );
      }
    }
  }

  private async checkPhotoPermissions(
    entityType: 'GYM' | 'CLASS',
    entityId: number,
    currentUserId: number,
    action: string,
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { userId: currentUserId },
      select: { role: true },
    });

    if (user?.role === 'ADMIN') return; // Admin bypass

    if (entityType === 'GYM') {
      const gym = await this.db.gym.findUnique({
        where: { gymId: entityId },
        select: { gymOwnerId: true },
      });
      if (gym?.gymOwnerId !== currentUserId) {
        throw new ForbiddenException(
          `Only the gym owner or admin can ${action}`,
        );
      }
    } else {
      const gymClass = await this.db.gymClasses.findUnique({
        where: { classId: entityId },
        select: { trainerId: true, gym: { select: { gymOwnerId: true } } },
      });
      if (
        gymClass?.gym.gymOwnerId !== currentUserId &&
        gymClass?.trainerId !== currentUserId
      ) {
        throw new ForbiddenException(
          `Only the gym owner, trainer, or admin can ${action}`,
        );
      }
    }
  }

  async updateUserProfilePic(
    userId: number,
    filePath: string,
    currentUserId: number,
  ) {
    // Ensure user can only update their own profile
    if (userId !== currentUserId) {
      throw new ForbiddenException(
        'You can only update your own profile picture',
      );
    }

    // Get current user to store old profile picture path
    const user = await this.db.user.findUnique({
      where: { userId },
      select: { profilePic: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldProfilePic = user.profilePic;

    // Update the user's profilePic in DB
    await this.db.user.update({
      where: { userId },
      data: { profilePic: filePath },
    });

    // Clean up old profile picture file (after successful DB update)
    if (oldProfilePic && oldProfilePic !== filePath) {
      try {
        await unlink(`.${oldProfilePic}`);
      } catch (error) {
        // Log error but don't fail the operation
        console.warn(
          `Failed to delete old profile picture: ${oldProfilePic}`,
          error,
        );
      }
    }

    return {
      message: 'Profile picture updated successfully',
      profilePic: filePath,
    };
  }

  async getUserProfilePic(userId: number) {
    const user = await this.db.user.findUnique({
      where: { userId },
      select: { profilePic: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      profilePic: user.profilePic || null,
    };
  }

  async uploadGymPhotos(
    gymId: number,
    filePaths: string[],
    coverIndex: number | undefined,
    currentUserId: number,
    orders?: number[],
  ) {
    // Check if gym exists
    const gym = await this.db.gym.findUnique({
      where: { gymId },
      select: { gymOwnerId: true },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'GYM',
      gymId,
      currentUserId,
      'upload photos',
    );

    // Check current photo count
    const currentCount = await this.db.photo.count({
      where: { entityType: 'GYM', entityId: gymId },
    });

    if (currentCount + filePaths.length > 10) {
      throw new BadRequestException(
        `Maximum 10 photos allowed for gyms. Current: ${currentCount}, trying to add: ${filePaths.length}`,
      );
    }

    // Ensure thumbnails directory exists
    await mkdir(process.env.THUMBNAIL_DIR || './uploads/thumbnails', {
      recursive: true,
    });

    // Create photo records
    const photos = await this.createPhotos(
      'GYM',
      +gymId,
      filePaths,
      coverIndex,
      orders,
    );

    // Generate thumbnails in parallel
    await this.generateThumbnails(photos);

    return {
      message: 'Photos uploaded successfully',
      photos,
    };
  }

  async getGymPhotos(gymId: number) {
    const gym = await this.db.gym.findUnique({
      where: { gymId },
      select: { gymId: true },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    const photos = await this.db.photo.findMany({
      where: {
        entityType: 'GYM',
        entityId: gymId,
      },
      orderBy: { order: 'asc' },
    });

    return { photos };
  }

  async uploadClassPhotos(
    classId: number,
    filePaths: string[],
    coverIndex: number | undefined,
    currentUserId: number,
    orders?: number[],
  ) {
    // Check if class exists
    const gymClass = await this.db.gymClasses.findUnique({
      where: { classId },
      select: {
        trainerId: true,
        gym: {
          select: { gymOwnerId: true },
        },
      },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'CLASS',
      classId,
      currentUserId,
      'upload photos',
    );

    // Check current photo count
    const currentCount = await this.db.photo.count({
      where: { entityType: 'CLASS', entityId: classId },
    });

    if (currentCount + filePaths.length > 5) {
      throw new BadRequestException(
        `Maximum 5 photos allowed for classes. Current: ${currentCount}, trying to add: ${filePaths.length}`,
      );
    }

    // Ensure thumbnails directory exists
    await mkdir(process.env.THUMBNAIL_DIR || './uploads/thumbnails', {
      recursive: true,
    });

    // Create photo records
    const photos = await this.createPhotos(
      'CLASS',
      +classId,
      filePaths,
      coverIndex,
      orders,
    );

    // Generate thumbnails in parallel
    await this.generateThumbnails(photos);

    return {
      message: 'Photos uploaded successfully',
      photos,
    };
  }

  async getClassPhotos(classId: number) {
    const gymClass = await this.db.gymClasses.findUnique({
      where: { classId },
      select: { classId: true },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    const photos = await this.db.photo.findMany({
      where: {
        entityType: 'CLASS',
        entityId: classId,
      },
      orderBy: { order: 'asc' },
    });

    return { photos };
  }

  async deleteGymPhoto(gymId: number, photoId: number, currentUserId: number) {
    // Check if gym exists
    const gym = await this.db.gym.findUnique({
      where: { gymId },
      select: { gymOwnerId: true },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'GYM',
      gymId,
      currentUserId,
      'delete photos',
    );

    // Find the photo
    const photo = await this.db.photo.findUnique({
      where: { id: photoId },
      select: {
        entityType: true,
        entityId: true,
        url: true,
        thumbnailUrl: true,
      },
    });

    if (!photo || photo.entityType !== 'GYM' || photo.entityId !== gymId) {
      throw new NotFoundException('Photo not found');
    }

    // If this is the cover photo, remove the cover reference
    await this.db.gym.updateMany({
      where: { gymId, coverPhotoId: photoId },
      data: { coverPhotoId: null },
    });

    // Delete the photo record
    await this.db.photo.delete({
      where: { id: photoId },
    });

    // Delete the files from disk
    await this.deletePhotoFiles(photo);

    return { message: 'Photo deleted successfully' };
  }

  async deleteClassPhoto(
    classId: number,
    photoId: number,
    currentUserId: number,
  ) {
    // Check if class exists
    const gymClass = await this.db.gymClasses.findUnique({
      where: { classId },
      select: {
        trainerId: true,
        gym: {
          select: { gymOwnerId: true },
        },
      },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'CLASS',
      classId,
      currentUserId,
      'delete photos',
    );

    // Find the photo
    const photo = await this.db.photo.findUnique({
      where: { id: photoId },
      select: {
        entityType: true,
        entityId: true,
        url: true,
        thumbnailUrl: true,
      },
    });

    if (!photo || photo.entityType !== 'CLASS' || photo.entityId !== classId) {
      throw new NotFoundException('Photo not found');
    }

    // If this is the cover photo, remove the cover reference
    await this.db.gymClasses.updateMany({
      where: { classId, coverPhotoId: photoId },
      data: { coverPhotoId: null },
    });

    // Delete the photo record
    await this.db.photo.delete({
      where: { id: photoId },
    });

    // Delete the files from disk
    await this.deletePhotoFiles(photo);

    return { message: 'Photo deleted successfully' };
  }

  async updateGymCoverPhoto(
    gymId: number,
    photoId: number,
    currentUserId: number,
  ) {
    // Check if gym exists
    const gym = await this.db.gym.findUnique({
      where: { gymId },
      select: { gymOwnerId: true },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'GYM',
      gymId,
      currentUserId,
      'update cover photo',
    );

    // Check if photo exists and belongs to this gym
    const photo = await this.db.photo.findUnique({
      where: { id: photoId },
      select: { entityType: true, entityId: true },
    });

    if (!photo || photo.entityType !== 'GYM' || photo.entityId !== gymId) {
      throw new NotFoundException('Photo not found for this gym');
    }

    // Update cover photo: set this photo as cover, unset others
    await this.db.photo.updateMany({
      where: { entityType: 'GYM', entityId: gymId },
      data: { isCover: false },
    });

    await this.db.photo.update({
      where: { id: photoId },
      data: { isCover: true },
    });

    // Update gym's coverPhotoId
    await this.db.gym.update({
      where: { gymId },
      data: { coverPhotoId: photoId },
    });

    return { message: 'Cover photo updated successfully' };
  }

  async updateClassCoverPhoto(
    classId: number,
    photoId: number,
    currentUserId: number,
  ) {
    // Check if class exists
    const gymClass = await this.db.gymClasses.findUnique({
      where: { classId },
      select: {
        trainerId: true,
        gym: {
          select: { gymOwnerId: true },
        },
      },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'CLASS',
      classId,
      currentUserId,
      'update cover photo',
    );

    // Check if photo exists and belongs to this class
    const photo = await this.db.photo.findUnique({
      where: { id: photoId },
      select: { entityType: true, entityId: true },
    });

    if (!photo || photo.entityType !== 'CLASS' || photo.entityId !== classId) {
      throw new NotFoundException('Photo not found for this class');
    }

    // Update cover photo: set this photo as cover, unset others
    await this.db.photo.updateMany({
      where: { entityType: 'CLASS', entityId: classId },
      data: { isCover: false },
    });

    await this.db.photo.update({
      where: { id: photoId },
      data: { isCover: true },
    });

    // Update class's coverPhotoId
    await this.db.gymClasses.update({
      where: { classId },
      data: { coverPhotoId: photoId },
    });

    return { message: 'Cover photo updated successfully' };
  }

  async updateGymPhotoOrders(
    gymId: number,
    photoOrders: { photoId: number; order: number }[],
    currentUserId: number,
  ) {
    // Check if gym exists
    const gym = await this.db.gym.findUnique({
      where: { gymId },
      select: { gymOwnerId: true },
    });

    if (!gym) {
      throw new NotFoundException('Gym not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'GYM',
      gymId,
      currentUserId,
      'reorder photos',
    );

    // Update orders in a transaction
    await this.db.$transaction(async (tx) => {
      for (const { photoId, order } of photoOrders) {
        // Verify photo belongs to this gym
        const photo = await tx.photo.findUnique({
          where: { id: photoId },
          select: { entityType: true, entityId: true },
        });

        if (!photo || photo.entityType !== 'GYM' || photo.entityId !== gymId) {
          throw new NotFoundException(
            `Photo ${photoId} not found for this gym`,
          );
        }

        await tx.photo.update({
          where: { id: photoId },
          data: { order },
        });
      }
    });

    return { message: 'Photo orders updated successfully' };
  }

  async updateClassPhotoOrders(
    classId: number,
    photoOrders: { photoId: number; order: number }[],
    currentUserId: number,
  ) {
    // Check if class exists
    const gymClass = await this.db.gymClasses.findUnique({
      where: { classId },
      select: {
        trainerId: true,
        gym: {
          select: { gymOwnerId: true },
        },
      },
    });

    if (!gymClass) {
      throw new NotFoundException('Class not found');
    }

    // Check user permissions
    await this.checkPhotoPermissions(
      'CLASS',
      classId,
      currentUserId,
      'reorder photos',
    );

    // Update orders in a transaction
    await this.db.$transaction(async (tx) => {
      for (const { photoId, order } of photoOrders) {
        // Verify photo belongs to this class
        const photo = await tx.photo.findUnique({
          where: { id: photoId },
          select: { entityType: true, entityId: true },
        });

        if (
          !photo ||
          photo.entityType !== 'CLASS' ||
          photo.entityId !== classId
        ) {
          throw new NotFoundException(
            `Photo ${photoId} not found for this class`,
          );
        }

        await tx.photo.update({
          where: { id: photoId },
          data: { order },
        });
      }
    });

    return { message: 'Photo orders updated successfully' };
  }
}
