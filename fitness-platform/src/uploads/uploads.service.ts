import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UploadsService {
  constructor(private readonly db: DatabaseService) {}

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

    // Update the user's profilePic in DB
    await this.db.user.update({
      where: { userId },
      data: { profilePic: filePath },
    });

    return {
      message: 'Profile picture updated successfully',
      profilePic: filePath,
    };
  }
}
