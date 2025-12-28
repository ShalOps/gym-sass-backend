import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, BadRequestException, UseInterceptors, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, ForbiddenException, NotFoundException, StreamableFile, } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductType } from '@prisma/client';
import * as fs from 'fs';
import { error } from 'console';
import { DatabaseService } from 'src/database/database.service';
import { join } from 'path';

  const diskStorageConfig = diskStorage({
    destination: (req, file, callback) => {
      if (file.fieldname === 'image') {
        callback(null, './uploads/images');
      } else if (file.fieldname === 'document') {
        callback(null, './uploads/documents');
      }
    },
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService, private readonly databaseService: DatabaseService) {}

  private cleanupFiles(files: { image?: string; document?: string | null }) {
  if (files.image && fs.existsSync(files.image)) {
    fs.unlinkSync(files.image);
  }
  if (files.document && fs.existsSync(files.document)) {
    fs.unlinkSync(files.document);
  }
}

  private parseCursor(cursor?: string): number | undefined {
    if (!cursor) return undefined;
    const parsed = Number(cursor);
    if (isNaN(parsed) || parsed <= 0) {
      throw new BadRequestException('cursor must be a positive number');
    }
    return parsed;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ], { storage: diskStorageConfig }))
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBearerAuth('JWT-auth')
  async create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: { image: Express.Multer.File[], document?: Express.Multer.File[] },
    @Req() req: RequestWithUser
    ) {

      const imageFile = files.image?.[0];
      const documentFile = files.document?.[0];

      const paths = {
        image: imageFile?.path,
        document: documentFile?.path,
      };

      if (!imageFile) {
        this.cleanupFiles(paths); 
        throw new BadRequestException('Product image is required');
      }

      if (imageFile && imageFile.size > 5 * 1024 * 1024) {
        this.cleanupFiles(paths); 
        throw new BadRequestException('Image must be smaller than 5MB');
      }

      if (!imageFile.mimetype.match(/image\/(jpg|jpeg|png)/)) {
        this.cleanupFiles(paths);
        throw new BadRequestException(
          'Only image files (jpg, png, gif) are allowed',
        );
      }
      
      let documentPath: string | null = null;

      if (createProductDto.type === ProductType.DIGITAL) { 
      
        if (!documentFile) {
          this.cleanupFiles(paths);
          throw new BadRequestException('Digital products require a document file');
        }

        if (documentFile.size > 500 * 1024 * 1024) {
          this.cleanupFiles(paths);
          throw new BadRequestException('Document must be smaller than 500MB');
        }
        documentPath = documentFile.path;
      }
     else if (createProductDto.type === ProductType.PHYSICAL){
      if (documentFile) {
        this.cleanupFiles(paths);
        throw new BadRequestException('Physical products cannot have a document attachment');
      }
    }
    
    try {
      return await this.productService.create(createProductDto, req.user.userId, imageFile.path, req.user.isVendor, documentPath);
    } catch (error) {
      this.cleanupFiles(paths);
      throw error
    }
      
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  findAll(@Query('cursor') cursor?: string) {
    return this.productService.findAll(this.parseCursor(cursor));
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get products by category' })
  findByCategory(@Param('category') category: string, @Query('cursor') cursor?: string) {
    return this.productService.getProductsByCategory(category, this.parseCursor(cursor));
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get products by type' })
  findByType(@Param('type') type: string, @Query('cursor') cursor?: string) {
    return this.productService.getProductsByType(type, this.parseCursor(cursor));
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List of  purchased items a user owns' })
  @Get('purchased')
  @ApiBearerAuth('JWT-auth')
  async purchasedItems(@Req() req: RequestWithUser,) {
    return this.productService.purchasedItems(req.user.userId)
  }

  @UseGuards(JwtAuthGuard)
  @Get("revenue")
  @ApiOperation({ summary: 'Get vendors revenue' })
  @ApiBearerAuth('JWT-auth')
  async getVendorSalesHistory(@Req() req: RequestWithUser)
  {
    return this.productService.getVendorRevenue(req.user.userId, req.user.isVendor)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ], { storage: diskStorageConfig }))
  @Patch(':id')
  @ApiOperation({ summary: 'Update a product a vendor owns' })
  @ApiBearerAuth('JWT-auth')
  async update(
    @Param('id') id: string, 
    @Body() updateProductDto: UpdateProductDto, 
    @Req() req: RequestWithUser,
    @UploadedFiles() files: { image?: Express.Multer.File[], document?: Express.Multer.File[] } = {} 
  ) {

    const imageFile = files.image?.[0];
    const documentFile = files.document?.[0];

    const cleanupNewFiles = () => {
      if (imageFile?.path && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      if (documentFile?.path && fs.existsSync(documentFile.path)) fs.unlinkSync(documentFile.path);
    };

    if (imageFile) {
      if (imageFile.size > 5 * 1024 * 1024) {
        cleanupNewFiles();
        throw new BadRequestException('Image must be smaller than 5MB');
      }
      if (!imageFile.mimetype.match(/image\/(jpg|jpeg|png)/)) {
        cleanupNewFiles();
        throw new BadRequestException('Invalid image format');
      }
    }

    if (documentFile) {
      if (documentFile.size > 500 * 1024 * 1024) {
        cleanupNewFiles();
        throw new BadRequestException('Document must be smaller than 500MB');
      }
    }

    try {
      return await this.productService.update(
        +id, 
        updateProductDto, 
        req.user.userId, 
        req.user.isVendor,
        imageFile?.path,    
        documentFile?.path  
      );
  } catch (error) {
    cleanupNewFiles(); 
    throw error;
  }

  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a product a vendor owns' })
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.productService.remove(+id, req.user.userId, req.user.isVendor);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download purchased item' })
  @Get('download/:id')
  @ApiBearerAuth('JWT-auth')
  async downloadDigitalProduct(
   @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId
    const productId = +id
    const ownership = await this.databaseService.purchasedItem.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
      include: { product: true }
    });

    if (!ownership) {
      throw new ForbiddenException('You have not purchased this product.');
    }

    const product = ownership.product;

    if (product.document){
      const absolutePath = join(process.cwd(), '', product.document);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('The requested file is missing from the server.');
    }


    const fileExt = extname(product.document); 
    const fileName = `${product.name.replace(/\s+/g, '_')}${fileExt}`;

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
    };
    
    const contentType = mimeTypes[fileExt.toLowerCase()] || 'application/octet-stream';

    const file = fs.createReadStream(absolutePath);
    
    return new StreamableFile(file, {
      type: contentType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }
    else {
      throw new NotFoundException("Product doesn't contain a file")
    }
  }


}
