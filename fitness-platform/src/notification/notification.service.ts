import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Notification, NotificationStatus } from '@prisma/client';

const PAGE_SIZE = 10

@Injectable()
export class NotificationService {
  constructor(private readonly databaseservice: DatabaseService) {}

  async paginate(notifications: Notification[], direction: 'asc' | 'desc'){

    const hasMore = notifications.length > PAGE_SIZE;
    const data = hasMore ? notifications.slice(0, PAGE_SIZE) : notifications;
    const nextCursor = hasMore ? notifications[notifications.length  - 1].notificationId : null;

    return { data, hasMore, nextCursor };
  }

  async findOlder(currentUserId: number, cursor?: number) {
    const notifications = await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          ...(cursor ? { notificationId: { gt: cursor }} : {} )
        },
        orderBy: {
          notificationId : 'asc',
        },
        take : PAGE_SIZE + 1

    });
    return this.paginate(notifications, 'asc')
  }

  async findLatest(currentUserId: number, cursor?: number) {
    const notifications = await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          ...(cursor ? {notificationId : { lt : cursor}} : {})
        },
        orderBy: {
          notificationId: 'desc'
        },
        take: PAGE_SIZE + 1
    });

    return this.paginate(notifications, 'desc')
  }

  async findUnread(currentUserId: number, cursor?: number) {
    const notifications = await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          status: NotificationStatus.UNREAD,
          ...(cursor ? { notificationId : { lt : cursor } } : {}),
        },
        orderBy: {
          notificationId : 'desc'
        },
        take: PAGE_SIZE + 1
      });

      return this.paginate(notifications, 'desc')
  }

  async findRead(currentUserId: number, cursor?: number ) {
    const notificatoins = await this.databaseservice.notification.findMany(
      {
        where: {
          userId: currentUserId,
          status: NotificationStatus.READ,
          ...(cursor ? {notificationId: {lt: cursor}} : {}),
        },
        orderBy: {
          notificationId: 'desc'
        },
        take: PAGE_SIZE + 1,
      });

      return this.paginate(notificatoins, 'desc')
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

    if (!notification) {
      throw new NotFoundException('This notification was not found')
    }

    return notification;
  }

  async updateToRead(id: number, currentUserId: number) {
   
    const notification = await this.findOne(id);

    if (!notification) {
      throw new NotFoundException('This notification was not found')
    }

    if(notification.userId !== currentUserId){
      throw new ForbiddenException('Cannot update another persons message')
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
      throw new ForbiddenException('Cannot delete another persons message')
    }

    return await this.databaseservice.notification.delete({
      where : {
        notificationId: id
      }
  });
  }

  async markAllAsRead(currentUserId: number) {
    const result = await this.databaseservice.notification.updateMany({
      where: {
        userId: currentUserId,
        status: NotificationStatus.UNREAD,
      },
      data: {
        status: NotificationStatus.READ,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }


  async deleteAllRead(currentUserId: number) {
    const result = await this.databaseservice.notification.deleteMany({
      where: {
        userId: currentUserId,
        status: NotificationStatus.READ,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }

  async getUnreadCount(currentUserId: number) {
    const count = await this.databaseservice.notification.count({
      where: {
        userId: currentUserId,
        status: NotificationStatus.UNREAD,
      },
    });

    return { count: count };
  }


}
