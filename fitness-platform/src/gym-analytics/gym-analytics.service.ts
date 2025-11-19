import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { BookingStatsQueryDto } from "./dto/booking-stats.dto";

@Injectable()
export class GymAnalyticsService {
  constructor(private databaseService: DatabaseService) {}

  async totalBookingsForGym(gymId: string, startDate?: string, endDate?: string) {
    const params: any[] = [gymId];
    let where = `b.gym_id = $1`;
    if (startDate) {
      params.push(startDate);
      where += ` AND b.created_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      where += ` AND b.created_at <= $${params.length}`;
    }

    const q = `SELECT COUNT(*)::int AS total FROM bookings b WHERE ${where}`;
    const result = (await this.databaseService.$queryRawUnsafe(q, ...params)) as Array<{ total: number }>;
    return { total: Number(result[0]?.total ?? 0) };
  }

    async bookingCounts(query: BookingStatsQueryDto) {
        const { gymId, userId, range = 'monthly', startDate, endDate } = query;

        const trunc = range === 'weekly' ? 'week' : range === 'daily' ? 'day' : 'month';

        const params: any[] = [];
        let whereClauses: string[] = [];

        if (gymId) {
            params.push(gymId);
            whereClauses.push(`b.gym_id = $${params.length}`);
        }
        if (userId) {
            params.push(userId);
            whereClauses.push(`b.user_id = $${params.length}`);
        }
        if (startDate) {
            params.push(startDate);
            whereClauses.push(`b.created_at >= $${params.length}`);
        }
        if (endDate) {
            params.push(endDate);
            whereClauses.push(`b.created_at <= $${params.length}`);
        }

        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const q = `
            SELECT date_trunc('${trunc}', b.created_at) AS period,
                    COUNT(*)::int AS count
            FROM bookings b
            ${where}
            GROUP BY period
            ORDER BY period;
        `;
        const rows = (await this.databaseService.$queryRawUnsafe(q, ...params)) as Array<{ period: Date; count: number }>;
        return rows.map((r: any) => ({
            period: r.period ? new Date(r.period).toISOString() : null,
            count: Number(r.count || 0),
        }));
  }
}
