import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ReviewService {

  constructor(private readonly databaseService: DatabaseService) {}
  
  async create(createReviewDto: CreateReviewDto, userId: number) {
    const check = this.databaseService.purchasedItem.findUnique({
      where: {
        userId_productId: {
          userId: userId,
          productId: createReviewDto.productId
        }
      }
    })

    if(!check){
      throw new BadRequestException("Cannot review a product you have not purchased")
    }

    return await this.databaseService.review.create({
      data:{
        userId,
        productId: createReviewDto.productId,
        comment: createReviewDto.comment
      }
    })
  }

  async getProductReviews(productId: number) {

    const check = await this.databaseService.product.findUnique(
      {
        where: {
          id: productId
        }
      }
    )

    if(!check){
      throw new NotFoundException("Product doesn't exist")
    }
    
    return await this.databaseService.review.findMany({
      where: {
        productId: productId,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            profilePic: true,
            userName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Show newest reviews first
      },
    });
}

}
