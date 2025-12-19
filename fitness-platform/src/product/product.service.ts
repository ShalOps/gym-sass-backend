import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductCategory, ProductType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { Product } from '@prisma/client';
const PAGE_SIZE = 10;


@Injectable()
export class ProductService {

  constructor(private readonly databaseService: DatabaseService) {}

  async paginate(product: Product[]) {
    const hasMore = product.length > PAGE_SIZE;
    const data = hasMore ? product.slice(0, PAGE_SIZE) : product;
    const nextCursor = hasMore
      ? product[product.length - 1].id
      : null;
  
    return { data, hasMore, nextCursor };
  }

  async create(createProductDto: CreateProductDto, userId: number, isVendor: boolean) {
    
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can create products');
    }
    
    const product = await this.databaseService.product.create({
      data: {
        ...createProductDto, vendorID: userId
      }
    })

    return product;
  }

  async findAll(cursor?: number) {
    const products = await this.databaseService.product.findMany({
      where: {
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { 
        id: 'asc'
      },
      take: PAGE_SIZE + 1,
      });
    return this.paginate(products);
  }

  async getProductsByCategory(category: ProductCategory | string, cursor?: number) {

    const normalizedCategory = category.toUpperCase();
    if (typeof category === 'string') {
      const valid = Object.values(ProductCategory).includes(normalizedCategory as ProductCategory);
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
        id: 'asc'
      },
      take: PAGE_SIZE + 1,
    });
    return this.paginate(products);
  }

  async getProductsByType(type: ProductType | string, cursor?: number) {

    const normalizedType = type.toUpperCase();
    if (typeof type === 'string') {
      const valid = Object.values(ProductType).includes(normalizedType as ProductType);
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
        id: 'asc'
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

  async update(id: number, updateProductDto: UpdateProductDto, userId: number, isVendor: boolean) {
    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can update products');
    }

    const productVendorId = await this.findOne(id);

    if (productVendorId.vendorID !== userId) {
      throw new UnauthorizedException('Vendors can only update their own products');
    }

    return await this.databaseService.product.update({
      where: { id },
      data: { ...updateProductDto },
    });
   
  }

  async remove(id: number, userId: number, isVendor: boolean) {

    if (!isVendor) {
      throw new UnauthorizedException('Only vendors can update products');
    }

    const productVendorId = await this.findOne(id);

    if (productVendorId.vendorID !== userId) {
      throw new UnauthorizedException('Vendors can only update their own products');
    }

    return await this.databaseService.product.delete({
      where: { id },
    });
  }

}
