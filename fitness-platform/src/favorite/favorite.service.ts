import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class FavoriteService {
  constructor(private readonly databaseService: DatabaseService) {}
  
  async toggleFavorite(createFavoriteDto: CreateFavoriteDto, userId: number) {
    const checkProduct = await this.databaseService.product.findUnique({
      where : {
        id: createFavoriteDto.productId
      }
    });

    if(!checkProduct){
      throw new NotFoundException("Product does not exist")
    }
    const checkFavoriteStatus = await this.databaseService.favorite.findUnique({
      where: {
        productId_userId: {
          productId: createFavoriteDto.productId,
          userId
        }
      }
    });

    if(checkFavoriteStatus){
      return await this.databaseService.favorite.delete({
        where: {
          productId_userId: {
          productId: createFavoriteDto.productId,
          userId
          }
        }
      })
    } 
    else {
      return await this.databaseService.favorite.create({
        data: {
          ...createFavoriteDto, userId
        }
      });
    }
  }

  async findAll(userId: number) {
      const checkFavorites = await this.databaseService.favorite.findMany({
        where: {
          userId: userId
        }
      });
      return checkFavorites
  }

}
