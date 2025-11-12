import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('profile/:userId')
  @UseGuards(JwtAuthGuard)
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

  @Post('gym/:id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload photos for a gym' })
  @ApiParam({ name: 'id', description: 'ID of the gym' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Photos, cover index, and optional orders',
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files (jpg, png, gif)',
        },
        coverIndex: {
          type: 'number',
          description: 'Index of the cover photo (0-based, optional)',
        },
        orders: {
          type: 'array',
          items: { type: 'number' },
          description:
            'Order values for each photo (optional, defaults to sequential)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Photos uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid files or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner can upload',
  })
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (req, file: UploadedFile, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    }),
  )
  async uploadGymPhotos(
    @Param('id') gymId: string,
    @UploadedFiles() files: Array<UploadedFile>,
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    for (const file of files) {
      if (!file.mimetype.match(/image\/(jpg|jpeg|png|gif)/)) {
        throw new BadRequestException(
          'Only image files (jpg, png, gif) are allowed',
        );
      }
    }

    const filePaths = files.map((file) => `/uploads/${file.filename}`);
    const body = req.body as { coverIndex?: string; orders?: string };
    const coverIndex = body.coverIndex
      ? parseInt(body.coverIndex, 10)
      : undefined;

    let orders: number[] | undefined;
    if (body.orders) {
      try {
        orders = JSON.parse(body.orders) as number[];
        if (!Array.isArray(orders) || orders.length !== files.length) {
          throw new BadRequestException(
            'Orders must be an array matching the number of files',
          );
        }
      } catch {
        throw new BadRequestException('Invalid orders format');
      }
    }

    if (
      coverIndex !== undefined &&
      (coverIndex < 0 || coverIndex >= files.length)
    ) {
      throw new BadRequestException('Invalid cover index');
    }

    const currentUserId = (req.user as User).userId;

    return this.uploadsService.uploadGymPhotos(
      +gymId,
      filePaths,
      coverIndex,
      currentUserId,
      orders,
    );
  }

  @Get('gym/:id/photos')
  @ApiOperation({ summary: 'Get photos for a gym' })
  @ApiParam({ name: 'id', description: 'ID of the gym' })
  @ApiResponse({
    status: 200,
    description: 'Photos retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Gym not found',
  })
  async getGymPhotos(@Param('id') gymId: string) {
    return await this.uploadsService.getGymPhotos(+gymId);
  }

  @Post('class/:id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload photos for a gym class' })
  @ApiParam({ name: 'id', description: 'ID of the class' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Photos, cover index, and optional orders',
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image files (jpg, png, gif)',
        },
        coverIndex: {
          type: 'number',
          description: 'Index of the cover photo (0-based, optional)',
        },
        orders: {
          type: 'array',
          items: { type: 'number' },
          description:
            'Order values for each photo (optional, defaults to sequential)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Photos uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid files or request',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner or trainer can upload',
  })
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (req, file: UploadedFile, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    }),
  )
  async uploadClassPhotos(
    @Param('id') classId: string,
    @UploadedFiles() files: Array<UploadedFile>,
    @Req() req: Request,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    for (const file of files) {
      if (!file.mimetype.match(/image\/(jpg|jpeg|png|gif)/)) {
        throw new BadRequestException(
          'Only image files (jpg, png, gif) are allowed',
        );
      }
    }

    const filePaths = files.map((file) => `/uploads/${file.filename}`);
    const body = req.body as { coverIndex?: string; orders?: string };
    const coverIndex = body.coverIndex
      ? parseInt(body.coverIndex, 10)
      : undefined;

    let orders: number[] | undefined;
    if (body.orders) {
      try {
        orders = JSON.parse(body.orders) as number[];
        if (!Array.isArray(orders) || orders.length !== files.length) {
          throw new BadRequestException(
            'Orders must be an array matching the number of files',
          );
        }
      } catch {
        throw new BadRequestException('Invalid orders format');
      }
    }

    if (
      coverIndex !== undefined &&
      (coverIndex < 0 || coverIndex >= files.length)
    ) {
      throw new BadRequestException('Invalid cover index');
    }

    const currentUserId = (req.user as User).userId;

    return this.uploadsService.uploadClassPhotos(
      +classId,
      filePaths,
      coverIndex,
      currentUserId,
      orders,
    );
  }

  @Get('class/:id/photos')
  @ApiOperation({ summary: 'Get photos for a gym class' })
  @ApiParam({ name: 'id', description: 'ID of the class' })
  @ApiResponse({
    status: 200,
    description: 'Photos retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Class not found',
  })
  async getClassPhotos(@Param('id') classId: string) {
    return await this.uploadsService.getClassPhotos(+classId);
  }

  @Delete('gym/:id/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a photo for a gym' })
  @ApiParam({ name: 'id', description: 'ID of the gym' })
  @ApiParam({ name: 'photoId', description: 'ID of the photo' })
  @ApiResponse({
    status: 200,
    description: 'Photo deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner can delete',
  })
  @ApiResponse({
    status: 404,
    description: 'Gym or photo not found',
  })
  async deleteGymPhoto(
    @Param('id') gymId: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.deleteGymPhoto(
      +gymId,
      +photoId,
      currentUserId,
    );
  }

  @Delete('class/:id/photos/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a photo for a gym class' })
  @ApiParam({ name: 'id', description: 'ID of the class' })
  @ApiParam({ name: 'photoId', description: 'ID of the photo' })
  @ApiResponse({
    status: 200,
    description: 'Photo deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner or trainer can delete',
  })
  @ApiResponse({
    status: 404,
    description: 'Class or photo not found',
  })
  async deleteClassPhoto(
    @Param('id') classId: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.deleteClassPhoto(
      +classId,
      +photoId,
      currentUserId,
    );
  }

  @Put('gym/:id/cover/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update cover photo for a gym' })
  @ApiParam({ name: 'id', description: 'ID of the gym' })
  @ApiParam({ name: 'photoId', description: 'ID of the photo to set as cover' })
  @ApiResponse({
    status: 200,
    description: 'Cover photo updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner can update',
  })
  @ApiResponse({
    status: 404,
    description: 'Gym or photo not found',
  })
  async updateGymCoverPhoto(
    @Param('id') gymId: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.updateGymCoverPhoto(
      +gymId,
      +photoId,
      currentUserId,
    );
  }

  @Put('class/:id/cover/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update cover photo for a gym class' })
  @ApiParam({ name: 'id', description: 'ID of the class' })
  @ApiParam({ name: 'photoId', description: 'ID of the photo to set as cover' })
  @ApiResponse({
    status: 200,
    description: 'Cover photo updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner or trainer can update',
  })
  @ApiResponse({
    status: 404,
    description: 'Class or photo not found',
  })
  async updateClassCoverPhoto(
    @Param('id') classId: string,
    @Param('photoId') photoId: string,
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.updateClassCoverPhoto(
      +classId,
      +photoId,
      currentUserId,
    );
  }

  @Put('gym/:id/photos/order')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update photo order for a gym' })
  @ApiParam({ name: 'id', description: 'ID of the gym' })
  @ApiBody({
    description: 'Photo order updates',
    schema: {
      type: 'object',
      properties: {
        photoOrders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              photoId: { type: 'number' },
              order: { type: 'number' },
            },
          },
          description: 'Array of photo ID and order pairs',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo orders updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner can reorder',
  })
  async updateGymPhotoOrders(
    @Param('id') gymId: string,
    @Body() body: { photoOrders: { photoId: number; order: number }[] },
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.updateGymPhotoOrders(
      +gymId,
      body.photoOrders,
      currentUserId,
    );
  }

  @Put('class/:id/photos/order')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update photo order for a gym class' })
  @ApiParam({ name: 'id', description: 'ID of the class' })
  @ApiBody({
    description: 'Photo order updates',
    schema: {
      type: 'object',
      properties: {
        photoOrders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              photoId: { type: 'number' },
              order: { type: 'number' },
            },
          },
          description: 'Array of photo ID and order pairs',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo orders updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only gym owner or trainer can reorder',
  })
  async updateClassPhotoOrders(
    @Param('id') classId: string,
    @Body() body: { photoOrders: { photoId: number; order: number }[] },
    @Req() req: Request,
  ) {
    const currentUserId = (req.user as User).userId;
    return await this.uploadsService.updateClassPhotoOrders(
      +classId,
      body.photoOrders,
      currentUserId,
    );
  }
}
