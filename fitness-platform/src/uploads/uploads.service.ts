/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
}
