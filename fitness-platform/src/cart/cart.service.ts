import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCartItemDto } from './dto/create-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart.dto';
import { DatabaseService } from 'src/database/database.service';
import { CartItem } from '@prisma/client';
import { ProductType } from '@prisma/client';
const PAGE_SIZE = 10;


@Injectable()
export class CartService {
  constructor(private readonly databaseService: DatabaseService) {}
  
  async paginate(cartItem: CartItem[]) {
    const hasMore = cartItem.length > PAGE_SIZE;
    const data = hasMore ? cartItem.slice(0, PAGE_SIZE) : cartItem;
    const nextCursor = hasMore
      ? cartItem[cartItem.length - 1].cartId
      : null;
    
    return { data, hasMore, nextCursor };
  }

  async create(createCartItemDto: CreateCartItemDto, userId: number) {
    let checkIfUserOwnsCart = await this.databaseService.cart.findUnique({
      where: {
        cartOwnerId: userId,
      },
    }); 

    if (!checkIfUserOwnsCart) {
      checkIfUserOwnsCart = await this.databaseService.cart.create({
        data: {
          cartOwnerId: userId,
        },
      });
    }

    const checkProduct = await this.databaseService.product.findUnique({
      where: {
        id: createCartItemDto.productId
      }
    })

    if(!checkProduct) {
      throw new NotFoundException("Product doesn't exist")
    }

    if(checkProduct.type !== ProductType.DIGITAL){
      throw new BadRequestException("Only Digital products can be added to cart")
    }
    
    const addItemToCart = await this.databaseService.cartItem.create({
      data: {
        cartId: checkIfUserOwnsCart.id,
        productId: createCartItemDto.productId,
      },
    });

    return addItemToCart

  }

  async findAllItemsInCart(userId: number, cursor?: number) {
    const cartItems = await this.databaseService.cartItem.findMany({
      where: {
        cart: {
          cartOwnerId: userId
        },
        ...(cursor ? { cartId: { gt: cursor } } : {}),
      },
      orderBy: { 
        cartId: 'asc'
      },
      take: PAGE_SIZE + 1,
      });
    return this.paginate(cartItems);
  }

  async remove(productId: number, userId: number) {

    let checkIfUserOwnsCart = await this.databaseService.cart.findUnique({
      where: {
        cartOwnerId: userId,
      },
      select: {
        id: true
      }
    }); 

    if (!checkIfUserOwnsCart) {
      throw new NotFoundException('User does not own a cart');
    }

    const checkProductExistsInCart = this.databaseService.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: checkIfUserOwnsCart.id,
          productId: productId,
        },
      },
    })

    if(!checkProductExistsInCart){
      throw new NotFoundException("Product doesn't exist in users cart")
    }

    return await this.databaseService.cartItem.delete({
      where: {
        cartId_productId: {
          cartId: checkIfUserOwnsCart.id,
          productId: productId,
        },
      },
    });
  }
}
