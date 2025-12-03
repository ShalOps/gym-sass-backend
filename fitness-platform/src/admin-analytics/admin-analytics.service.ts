import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async totalUsers() {
    const numberOfUsers = await this.databaseService.user.count();
    return { count: numberOfUsers };
  }

  async usersByRole() {
    const usersByRole = await this.databaseService.user.groupBy({
      by: ['role'],
      _count: {
        userId: true,
      },
    });
    return usersByRole;
  }

  async usersByGender() {
    const usersByGender = await this.databaseService.user.groupBy({
      by: ['gender'],
      _count: {
        userId: true,
      },
    });
    return usersByGender;
  }

  async usersByGoal() {
    const usersByGoal = await this.databaseService.user.groupBy({
      by: ['goal'],
      _count: {
        userId: true,
      },
    });
    return usersByGoal;
  }

  async newUsersDaily() {
    type DailyCount = {
      day: Date;
      count: bigint;
    };
    try {
      const result = await this.databaseService.$queryRaw<DailyCount[]>`
      SELECT 
        DATE_TRUNC('day', "createdAt") AS day,
        COUNT(*) AS count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `;

      return result.map((row) => ({
        period: row.day.toISOString().slice(0, 10),
        count: Number(row.count),
      }));
    } catch (error) {
      console.error('Error in newUsersDaily: ', error);
      throw error;
    }
  }

  async newUsersWeekly() {
    type WeeklyCount = {
      week: Date;
      count: bigint;
    };
    try {
      const result = await this.databaseService.$queryRaw<WeeklyCount[]>`
      SELECT 
        DATE_TRUNC('week', "createdAt") AS "week",
        COUNT(*) AS "count"
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY "week"
      ORDER BY "week" ASC`;

      return result.map((row) => ({
        period: row.week.toISOString().slice(0, 10),
        count: Number(row.count),
      }));
    } catch (error) {
      console.error('Error in newUsersWeekly: ', error);
      throw error;
    }
  }

  async newUsersPerMonth() {
    type MonthlyCountRow = {
      month: Date;
      count: bigint;
    };

    try {
      const result = await this.databaseService.$queryRaw<MonthlyCountRow[]>`
      SELECT 
        DATE_TRUNC('month', "createdAt")::date AS "month",
        COUNT(*) AS "count"
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '365 days'
      GROUP BY DATE_TRUNC('month', "createdAt")::date
      ORDER BY DATE_TRUNC('month', "createdAt")::date ASC
    `;

      return result.map((row) => ({
        period: row.month.toISOString().slice(0, 7),
        count: Number(row.count),
      }));
    } catch (error) {
      console.error('Error in newUsersPerMonth: ', error);
      throw error;
    }
  }

  async activeUsers() {
    const activeUsers = await this.databaseService.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });
    return { count: activeUsers };
  }

  async ageDistribution() {
    type ageCountRow = {
      age_group: string;
      count: bigint;
    };

    try {
      const result = await this.databaseService.$queryRaw<ageCountRow[]>`
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) < 18     THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) <= 24    THEN '18-24'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) <= 34    THEN '25-34'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) <= 44    THEN '35-44'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) <= 54    THEN '45-54'
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) <= 64    THEN '55-64'
          ELSE '65+'
        END AS age_group,
        COUNT(*) AS count
      FROM "User"
      WHERE "birthDate" IS NOT NULL
      GROUP BY 1             
      ORDER BY 1
    `;

      return result.map((row) => ({
        ageGroup: row.age_group,
        count: Number(row.count),
      }));
    } catch (error) {
      console.error('Error in ageDistribution: ', error);
      throw error;
    }
  }

  async gymsByVerificationStatus() {
    const [totalGyms, verifiedCount] = await Promise.all([
      this.databaseService.gym.count(),

      this.databaseService.gym.count({
        where: { verified: true },
      }),
    ]);

    const unverifiedCount = totalGyms - verifiedCount;

    return {
      totalGyms,
      verified: verifiedCount,
      unverified: unverifiedCount,
    };
  }

  private buildDateFilter(
    from?: string,
    to?: string,
  ): { gte?: Date; lte?: Date } | undefined {
    const where: { gte?: Date; lte?: Date } = {};

    if (from) {
      where.gte = new Date(from);
    }

    if (to) {
      where.lte = new Date(to);
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  async gymsByServices(limit: number = 10, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const serviceFilter = dateFilter ? { createdAt: dateFilter } : {};

    const gyms = await this.databaseService.gym.findMany({
      where: {
        services: {
          some: serviceFilter,
        },
      },
      select: {
        gymId: true,
        gymName: true,
        _count: {
          select: {
            services: true,
          },
        },
      },
      orderBy: {
        services: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return gyms.map((gym) => ({
      gymId: gym.gymId,
      gymName: gym.gymName,
      count: gym._count.services,
    }));
  }

  async gymsByClasses(limit: number = 10, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const classFilter = dateFilter ? { createdAt: dateFilter } : {};

    type GymWithClassCount = {
      gymId: number;
      gymName: string;
      _count: {
        gymClasses: number;
      };
    };

    const gyms: GymWithClassCount[] = await this.databaseService.gym.findMany({
      where: {
        gymClasses: {
          some: classFilter,
        },
      },
      select: {
        gymId: true,
        gymName: true,
        _count: {
          select: {
            gymClasses: true,
          },
        },
      },
      orderBy: {
        gymClasses: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return gyms.map((gym) => ({
      gymId: gym.gymId,
      gymName: gym.gymName,
      count: gym._count.gymClasses,
    }));
  }

  async popularClassSchedules(limit: number = 10, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const classFilter = dateFilter ? { createdAt: dateFilter } : {};

    const schedules = await this.databaseService.gymClasses.groupBy({
      by: ['classSchedule'],
      _count: {
        classId: true,
      },
      where: classFilter,
      orderBy: {
        _count: {
          classId: 'desc',
        },
      },
      take: limit,
    });

    return schedules.map((item) => ({
      schedule: item.classSchedule,
      count: Number(item._count.classId),
    }));
  }

  async topTrainersByClasses(limit: number = 10, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const trainerFilter = dateFilter ? { createdAt: dateFilter } : {};

    type TrainerWithClassCount = {
      userId: number;
      firstName: string;
      lastName: string;
      userName: string;
      _count: {
        gymclasses: number;
      };
    };

    const trainers: TrainerWithClassCount[] =
      await this.databaseService.user.findMany({
        where: {
          role: 'TRAINER',
          gymclasses: {
            some: trainerFilter,
          },
        },
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          userName: true,
          _count: {
            select: {
              gymclasses: true,
            },
          },
        },
        orderBy: {
          gymclasses: {
            _count: 'desc',
          },
        },
        take: limit,
      });

    return trainers.map((trainer) => ({
      trainerId: trainer.userId,
      name: `${trainer.firstName} ${trainer.lastName}`,
      userName: trainer.userName,
      count: trainer._count.gymclasses,
    }));
  }

  async gymClassPricingInsights(
    limit: number = 20,
    from?: string,
    to?: string,
  ) {
    const dateFilter = this.buildDateFilter(from, to);
    const classFilter = dateFilter ? { createdAt: dateFilter } : {};

    const gyms = await this.databaseService.gym.findMany({
      where: {
        gymClasses: {
          some: classFilter,
        },
      },
      select: {
        gymId: true,
        gymName: true,
        gymClasses: {
          select: {
            price: true,
          },
        },
      },
      orderBy: {
        gymClasses: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return gyms
      .map((gym) => {
        const classes = gym.gymClasses as { price: number }[];
        const totalClasses = classes.length;
        const avgPrice =
          totalClasses > 0
            ? Number(
                (
                  classes.reduce((sum, c) => sum + c.price, 0) / totalClasses
                ).toFixed(2),
              )
            : 0;

        return {
          gymId: gym.gymId,
          gymName: gym.gymName,
          totalClasses,
          averagePrice: avgPrice,
        };
      })
      .filter((g) => g.totalClasses > 0);
  }

  async getRevenueAnalytics(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const whereCondition = {
      status: { in: [PaymentStatus.PROCESSED, PaymentStatus.PAID_MANUAL] },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const [totalRevenue, revenueByType] = await Promise.all([
      this.databaseService.payment.aggregate({
        _sum: { amount: true },
        where: whereCondition,
      }),
      this.databaseService.payment.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: whereCondition,
      }),
    ]);

    return {
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      revenueByType: revenueByType.map((item) => ({
        type: item.type,
        amount: Number(item._sum.amount || 0),
      })),
    };
  }
}
