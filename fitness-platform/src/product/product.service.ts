import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductCategory, ProductType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { Product } from '@prisma/client';
import * as fs from 'fs';
const PAGE_SIZE = 10;

@Injectable()
export class ProductService {
  constructor(private readonly databaseService: DatabaseService) {}

  paginate(product: Product[]) {
    const hasMore = product.length > PAGE_SIZE;
    const data = hasMore ? product.slice(0, PAGE_SIZE) : product;
    const nextCursor = hasMore ? product[product.length - 1].id : null;

    return { data, hasMore, nextCursor };
  }

  async create(
    createProductDto: CreateProductDto,
    userId: number,
    imagePath: string,
    isVendor: boolean,
    documentPath: string | null,
  ) {
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can create products');
    }

    const product = await this.databaseService.product.create({
      data: {
        ...createProductDto,
        image: imagePath,
        vendorID: userId,
        document: documentPath,
      },
    });

    return product;
  }

  async findAll(cursor?: number) {
    const products = await this.databaseService.product.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: PAGE_SIZE + 1,
    });
    return this.paginate(products);
  }

  async getProductsByCategory(
    category: ProductCategory | string,
    cursor?: number,
  ) {
    const normalizedCategory = category.toUpperCase();
    if (typeof category === 'string') {
      const valid = Object.values(ProductCategory).includes(
        normalizedCategory as ProductCategory,
      );
      if (!valid) {
        throw new BadRequestException('Invalid product category');
      }
    }

    const products = await this.databaseService.product.findMany({
      where: {
        category: normalizedCategory as ProductCategory,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: PAGE_SIZE + 1,
    });
    return this.paginate(products);
  }

  async getProductsByType(type: ProductType | string, cursor?: number) {
    const normalizedType = type.toUpperCase();
    if (typeof type === 'string') {
      const valid = Object.values(ProductType).includes(
        normalizedType as ProductType,
      );
      if (!valid) {
        throw new BadRequestException('Invalid product type');
      }
    }

    const products = await this.databaseService.product.findMany({
      where: {
        type: normalizedType as ProductType,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: {
        id: 'asc',
      },
      take: PAGE_SIZE + 1,
    });

    return this.paginate(products);
  }

  async findOne(id: number) {
    const product = await this.databaseService.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    userId: number,
    isVendor: boolean,
    newImagePath?: string,
    newDocumentPath?: string,
  ) {
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can update products');
    }

    const productVendorId = await this.findOne(id);

    if (productVendorId.vendorID !== userId) {
      throw new UnauthorizedException(
        'Vendors can only update their own products',
      );
    }

    const currentProduct = await this.databaseService.product.findUnique({
      where: { id },
    });

    if (!currentProduct) {
      throw new NotFoundException('Product not found');
    }
    if (
      currentProduct.type == ProductType.PHYSICAL &&
      updateProductDto.type != ProductType.DIGITAL
    ) {
      if (newDocumentPath) {
        throw new BadRequestException(
          'Cannot upload Document on physical product',
        );
      }
    }

    if (
      newImagePath &&
      currentProduct.image &&
      newDocumentPath &&
      currentProduct.document
    ) {
      const updatedProduct = await this.databaseService.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          image: newImagePath,
          document: newDocumentPath,
        },
      });
      this.deleteFileOnDisk(currentProduct.image);
      this.deleteFileOnDisk(currentProduct.document);
      return updatedProduct;
    } else if (newImagePath && currentProduct.image) {
      const updatedProduct = await this.databaseService.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          image: newImagePath,
        },
      });
      this.deleteFileOnDisk(currentProduct.image);
      return updatedProduct;
    } else if (newDocumentPath && currentProduct.document) {
      const updatedProduct = await this.databaseService.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          document: newDocumentPath,
        },
      });
      this.deleteFileOnDisk(currentProduct.document);
      return updatedProduct;
    }

    return await this.databaseService.product.update({
      where: { id },
      data: {
        ...updateProductDto,
      },
    });
  }

  private deleteFileOnDisk(filePath: string) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Failed to delete old file: ${filePath}`, err);
      }
    }
  }

  async remove(id: number, userId: number, isVendor: boolean) {
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can delete products');
    }

    const product = await this.findOne(id);

    if (product.vendorID !== userId) {
      throw new UnauthorizedException(
        'Vendors can only delete their own products',
      );
    }

    const imagePath = product.image;
    const documentPath = product.document;

    if (imagePath) {
      this.deleteFileOnDisk(imagePath);
    }
    if (documentPath) {
      this.deleteFileOnDisk(documentPath);
    }
    return await this.databaseService.product.delete({
      where: { id },
    });
  }

  async purchasedItems(userId: number) {
    return await this.databaseService.purchasedItem.findMany({
      where: {
        userId,
      },
    });
  }

  async getVendorRevenue(vendorId: number, isVendor: boolean) {
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can check their revenue');
    }
    const sales = await this.databaseService.purchasedItem.findMany({
      where: {
        product: { vendorID: vendorId },
      },
      include: {
        product: true,
      },
    });

    const totalRevenue = sales.reduce(
      (sum, item) => sum + item.product.price,
      0,
    );
    const totalUnitsSold = sales.length;

    return {
      totalRevenue,
      totalUnitsSold,
    };
  }
}
