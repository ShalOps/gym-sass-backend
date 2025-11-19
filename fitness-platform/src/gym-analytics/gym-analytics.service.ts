import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";

@Injectable()
export class GymAnalyticsService {
  constructor(private databaseService: DatabaseService) {}

  // 1) Total bookings for a gym (fast aggregate)
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
}
