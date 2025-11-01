import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

type UploadedFile = {
  mimetype: string;
  filename: string;
  originalname: string;
};

interface User {
  userId: number;
  role: string;
}

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('profile/:userId')
  @ApiOperation({ summary: 'Upload or update user profile picture' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile picture file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, png, gif)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Profile picture updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only update own profile',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (req, file: UploadedFile, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  async uploadProfile(
    @Param('userId') userId: string,
    @UploadedFile() file: UploadedFile,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.match(/image\/(jpg|jpeg|png|gif)/)) {
      throw new BadRequestException(
        'Only image files (jpg, png, gif) are allowed',
      );
    }

    const currentUserId = (req.user as User).userId;
    const filePath = `/uploads/${file.filename}`;

    return this.uploadsService.updateUserProfilePic(
      +userId,
      filePath,
      currentUserId,
    );
  }

  @Get('profile/:userId')
  @ApiOperation({ summary: 'Get user profile picture URL' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiResponse({
    status: 404,
    description: 'User not found or no profile picture',
  })
  async getProfilePic(@Param('userId') userId: string) {
    return await this.uploadsService.getUserProfilePic(+userId);
  }
}
