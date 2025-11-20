import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { NotificationStatus } from '@prisma/client';


@Injectable()
export class NotificationService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async findOlder(currentUserId: number) {
    return await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
        },
        orderBy: {
          createdAt: 'asc'
        }
    }
    );
  }

  async findLatest(currentUserId: number) {
    return await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
        },
        orderBy: {
          createdAt: 'desc'
        }
    }
    );
  }

  async findUnread(currentUserId: number) {
    return await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          status: NotificationStatus.UNREAD
        }
      }
      );
  }

  async findRead(currentUserId: number) {
    return await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          status: NotificationStatus.READ
        }
      }
      );
  }

  async findOne(id: number){

     const notification = await this.databaseservice.notification.findUnique({
      where: {
        notificationId: id
      },
      select: {
        userId: true,
      }
    })
    return notification;
  }

  async updateToRead(id: number, currentUserId: number) {
   
    const notification = await this.findOne(id);

    if (!notification) {
      throw new NotFoundException('This notification was not found')
    }

    if(notification.userId !== currentUserId){
      throw new NotFoundException('Cannot update another persons message')
    }
    return await this.databaseservice.notification.update({
      where: {
        notificationId: id
      },
      data: {
        status: NotificationStatus.READ
      }
    });
  }

  async remove(id: number, currentUserId: number) {

    const notification = await this.findOne(id);

    if (!notification) {
      throw new NotFoundException('This notification was not found')
    }

    if(notification.userId !== currentUserId){
      throw new NotFoundException('Cannot delete another persons message')
    }

    return await this.databaseservice.notification.delete({
      where : {
        notificationId: id
      }
  });
  }

}
