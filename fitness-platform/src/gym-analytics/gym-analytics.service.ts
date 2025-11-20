import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { BookingStatsQueryDto } from "./dto/booking-stats.dto";
import { RevenueStatsQueryDto } from "./dto/revenue-stats.dto";

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

   async userActivity(userId: string, startDate?: string, endDate?: string) {
    const params: any[] = [userId];
    let whereClauses = ['b.user_id = $1'];

    if (startDate) {
      params.push(startDate);
      whereClauses.push(`b.created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      whereClauses.push(`b.created_at <= $${params.length}`);
    }

    const where = whereClauses.join(' AND ');
    const q = `
      SELECT
        COUNT(*)::int AS total_bookings,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END)::int AS cancelled_bookings,
        COUNT(DISTINCT date_trunc('day', b.created_at))::int AS active_days,
        MAX(b.created_at) AS last_booking_at
      FROM bookings b
      WHERE ${where};
    `;

    const res = (await this.databaseService.$queryRawUnsafe(q, ...params)) as Array<{
      total_bookings: number;
      cancelled_bookings: number;
      active_days: number;
      last_booking_at: Date | null;
    }>;
    const r = res[0] || {};
    return {
      totalBookings: Number(r.total_bookings ?? 0),
      cancelledBookings: Number(r.cancelled_bookings ?? 0),
      activeDays: Number(r.active_days ?? 0),
      lastBookingAt: r.last_booking_at ? new Date(r.last_booking_at).toISOString() : null,
    };
  }

// this one will work when the payment module is ready
  async revenueStats(qparams: RevenueStatsQueryDto) {
    const { gymId, startDate, endDate, currency } = qparams;
    const params: any[] = [];
    const where: string[] = [];

    if (gymId) {
      params.push(gymId);
      where.push(`b.gym_id = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      where.push(`p.created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      where.push(`p.created_at <= $${params.length}`);
    }
    if (currency) {
      params.push(currency);
      where.push(`p.currency = $${params.length}`);
    }

    where.push(`p.status = 'paid'`);

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        COALESCE(SUM(p.amount),0)::numeric::float8 AS total_revenue,
        COUNT(p.*)::int AS payments_count
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        ${whereClause};
    `;

    const res = (await this.databaseService.$queryRawUnsafe(sql, ...params)) as Array<{
      total_revenue: number;
      payments_count: number;
    }>;
    const row = res[0] || {};
    return {
      totalRevenue: Number(row.total_revenue ?? 0),
      paymentsCount: Number(row.payments_count ?? 0),
    };
  }
}
