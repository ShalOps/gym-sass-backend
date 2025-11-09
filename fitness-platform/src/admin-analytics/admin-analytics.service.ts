import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';


@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly databaseService: DatabaseService){}

  async totalUsers() {
     const numberOfUsers = await this.databaseService.user.count();
     return `Total number of users ${numberOfUsers}`;
  }

  async usersByRole(){
    const usersByRole = await this.databaseService.user.groupBy({
      by: ['role'], 
      _count: {
        userId: true,
      },
    })
    return usersByRole;
  }

  async usersByGender(){
    const usersByGender = await this.databaseService.user.groupBy({
      by: ['gender'], 
      _count: {
        userId: true,
      },
    })
    return usersByGender;
  }
  
  async usersByGoal(){
    const usersByGender = await this.databaseService.user.groupBy({
      by: ['goal'], 
      _count: {
        userId: true,
      },
    })
    return usersByGender;
  }

  async newUsersDaily(){
      const newUsersDaily = await this.databaseService.user.groupBy({
        by: ['createdAt'],
        _count: { _all: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: 'asc' },
      })

      return newUsersDaily;
  }

  async newUsersWeekly(){
    const newUsersWeekly = await this.databaseService.$queryRaw`
      SELECT 
        DATE_TRUNC('week', "createdAt") AS "creationWeek",
        COUNT(userId) AS "count"
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY "creationWeek"
      ORDER BY "creationWeek" ASC`

      return newUsersWeekly
  }


  async newUsersPerMonth() {
    type MonthlyCountRow = {
      creationMonth: Date;
      count: bigint;
    };

    const result = await this.databaseService.$queryRaw<MonthlyCountRow[]>`
      SELECT 
        DATE_TRUNC('month', "createdAt")::date AS "creationMonth",
        COUNT(*) AS "count"
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '365 days'
      GROUP BY DATE_TRUNC('month', "createdAt")::date
      ORDER BY DATE_TRUNC('month', "createdAt")::date ASC
    `;  

    return result.map((row) => ({
      creationMonth: row.creationMonth.toISOString().slice(0, 7),
      count: Number(row.count),
    }));
  }

  async activeUsers(){
    const activeUsers = await this.databaseService.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });
    return `Number of active user is: ${activeUsers}`;
  }

  async ageDistribution() {
    const result = await this.databaseService.$queryRaw<
      Array<{ age_group: string; count: bigint }>
    >`
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, "birthDate")) < 18      THEN 'Under 18'
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
      GROUP BY 1               -- 1 = the CASE expression (the first selected column)
      ORDER BY 1;              -- keep the same order
    `;

    return result.map(r => ({
      ageGroup: r.age_group,
      count: Number(r.count),
    }));
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

    async gymsByServices(limit: number = 10) {
    const gyms = await this.databaseService.gym.findMany({
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

    return gyms.map(gym => ({
      gymId: gym.gymId,
      gymName: gym.gymName,
      serviceCount: gym._count.services,
    }));
  }

    async gymsByClasses(limit: number = 10) {
    const gyms = await this.databaseService.gym.findMany({
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

    return gyms.map(gym => ({
      gymId: gym.gymId,
      gymName: gym.gymName,
      classCount: gym._count.gymClasses,
    }));
  }

  async popularClassSchedules(limit: number = 10) {
    const schedules = await this.databaseService.gymClasses.groupBy({
      by: ['classSchedule'],
      _count: {
        classId: true,
      },
      orderBy: {
        _count: {
          classId: 'desc',
        },
      },
      take: limit,
    });

    return schedules.map(item => ({
      schedule: item.classSchedule,
      classCount: item._count.classId,
    }));
  }

  async topTrainersByClasses(limit: number = 10) {
    const trainers = await this.databaseService.user.findMany({
      where: {
        role: 'TRAINER',
        gymclasses: {
          some: {}, 
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

    return trainers.map(trainer => ({
      trainerId: trainer.userId,
      name: `${trainer.firstName} ${trainer.lastName}`,
      userName: trainer.userName,
      classCount: trainer._count.gymclasses,
    }));
  }

  async gymClassPricingInsights(limit: number = 20) {
    const gyms = await this.databaseService.gym.findMany({
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
      .map(gym => {
        const classes = gym.gymClasses;
        const totalClasses = classes.length;
        const avgPrice =
          totalClasses > 0
            ? Number(
                (
                  classes.reduce((sum, c) => sum + c.price, 0) / totalClasses
                ).toFixed(2)
              )
            : 0;

        return {
          gymId: gym.gymId,
          gymName: gym.gymName,
          totalClasses,
          averagePrice: avgPrice,
        };
      })
      .filter(g => g.totalClasses > 0); 
  }

    async totalClassesPerGym(limit: number = 20) {
    const gyms = await this.databaseService.gym.findMany({
      select: {
        gymId: true,
        gymName: true,
        _count: {
          select: {
            gymClasses: true,
          },
        },
      },
      where: {
        gymClasses: {
          some: {}, // Only gyms with at least one class
        },
      },
      orderBy: {
        gymClasses: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return gyms.map(gym => ({
      gymId: gym.gymId,
      gymName: gym.gymName,
      totalClasses: gym._count.gymClasses,
    }));
  }




}
