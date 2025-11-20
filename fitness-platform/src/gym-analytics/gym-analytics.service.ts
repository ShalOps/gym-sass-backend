import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { BookingStatsQueryDto } from "./dto/booking-stats.dto";
import { RevenueStatsQueryDto } from "./dto/revenue-stats.dto";
import { DateRangeDto } from "./dto/date-range.dto";

@Injectable()
export class GymAnalyticsService {
  constructor(private databaseService: DatabaseService) {}

  async getTotalBookings(query: DateRangeDto) {
    const { gymId, startDate, endDate } = query;

    return this.databaseService.$queryRaw`
      SELECT
        (SELECT COUNT(*) FROM "ClassBooking" cb
         JOIN "GymClasses" gc ON gc."classId" = cb."classId"
         ${gymId ? this.databaseService.raw(`WHERE gc."gymId" = ${gymId}`) : this.databaseService.empty}
         ${startDate ? this.databaseService.raw(`AND cb."bookedAt" >= ${startDate}`) : this.databaseService.empty}
         ${endDate ? this.databaseService.raw(`AND cb."bookedAt" <= ${endDate}`) : this.databaseService.empty}
        ) +
        (SELECT COUNT(*) FROM "ServiceBooking" sb
         JOIN "Service" s ON s."serviceId" = sb."serviceId"
         ${gymId ? this.databaseService.raw(`WHERE s."gymId" = ${gymId}`) : this.databaseService.empty}
         ${startDate ? this.databaseService.raw(`AND sb."bookedAt" >= ${startDate}`) : this.databaseService.empty}
         ${endDate ? this.databaseService.raw(`AND sb."bookedAt" <= ${endDate}`) : this.databaseService.empty}
        ) AS total;
    `;
  }

    async getMonthlyBookings(query: StatsQueryDto) {
    const { gymId, startDate, endDate } = query;

    return this.prisma.$queryRaw`
      SELECT DATE_TRUNC('month', b."bookedAt") AS month,
             COUNT(*)::int AS total
      FROM (
        SELECT cb."bookedAt", gc."gymId"
        FROM "ClassBooking" cb
        JOIN "GymClasses" gc ON gc."classId" = cb."classId"

        UNION ALL

        SELECT sb."bookedAt", s."gymId"
        FROM "ServiceBooking" sb
        JOIN "Service" s ON s."serviceId" = sb."serviceId"
      ) b
      WHERE (${gymId} IS NULL OR b."gymId" = ${gymId})
      AND (${startDate} IS NULL OR b."bookedAt" >= ${startDate})
      AND (${endDate} IS NULL OR b."bookedAt" <= ${endDate})
      GROUP BY month
      ORDER BY month ASC;
    `;
  }

     async getUserActivity() {
      return this.databaseService.$queryRaw`
        SELECT 
          u."userId",
          u."userName",
          (SELECT COUNT(*) FROM "ClassBooking" cb WHERE cb."userId" = u."userId") +
          (SELECT COUNT(*) FROM "ServiceBooking" sb WHERE sb."userId" = u."userId")
          AS totalBookings,
          
          (SELECT COUNT(*) FROM (
            SELECT DATE(cb."bookedAt") AS day FROM "ClassBooking" cb WHERE cb."userId" = u."userId"
            UNION 
            SELECT DATE(sb."bookedAt") AS day FROM "ServiceBooking" sb WHERE sb."userId" = u."userId"
          ) AS days) AS activeDays,

          (SELECT COUNT(*) FROM "ClassBooking" cb WHERE cb."userId" = u."userId" AND cb.status = 'CANCELLED') +
          (SELECT COUNT(*) FROM "ServiceBooking" sb WHERE sb."userId" = u."userId" AND sb.status = 'CANCELLED')
          AS cancelled,

          (SELECT COUNT(*) FROM "ClassBooking" cb WHERE cb."userId" = u."userId" AND cb.status = 'COMPLETED') +
          (SELECT COUNT(*) FROM "ServiceBooking" sb WHERE sb."userId" = u."userId" AND sb.status = 'COMPLETED')
          AS completed
          
        FROM "User" u
        ORDER BY totalBookings DESC;
      `;
    }


// this one will work when the payment module is ready
  async getRevenueStats(query: DateRangeDto) {
    const { gymId, startDate, endDate } = query;

    return this.databaseService.$queryRaw`
      SELECT 
        SUM(b.price)::float AS totalRevenue
      FROM (
        SELECT gc.price, cb."bookedAt", gc."gymId", cb."paymentStatus"
        FROM "ClassBooking" cb
        JOIN "GymClasses" gc ON gc."classId" = cb."classId"

        UNION ALL

        SELECT s.price, sb."bookedAt", s."gymId", sb."paymentStatus"
        FROM "ServiceBooking" sb
        JOIN "Service" s ON s."serviceId" = sb."serviceId"
      ) b
      WHERE b."paymentStatus" = 'PROCESSED'
      AND (${gymId} IS NULL OR b."gymId" = ${gymId})
      AND (${startDate} IS NULL OR b."bookedAt" >= ${startDate})
      AND (${endDate} IS NULL OR b."bookedAt" <= ${endDate});
    `;
  }
}

