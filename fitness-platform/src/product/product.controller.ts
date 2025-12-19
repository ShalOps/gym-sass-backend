import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { RequestWithUser } from '../auth/express-request-with-user.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBearerAuth('JWT-auth')
  create(@Body() createProductDto: CreateProductDto, @Req() req: RequestWithUser) {
    return this.productService.create(createProductDto, req.user.userId, req.user.isVendor);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a product a vendor owns' })
  @ApiBearerAuth('JWT-auth')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Req() req: RequestWithUser) {
    return this.productService.update(+id, updateProductDto, req.user.userId, req.user.isVendor);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a product a vendor owns' })
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.productService.remove(+id, req.user.userId, req.user.isVendor);
  }

}
