import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler, IntentData } from './intent-handler.interface';
import { DatabaseService } from '../database/database.service';
import { AiService } from './ai/ai.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { z } from 'zod';

@Injectable()
export class WorkoutPlannerService implements IntentHandler {
  private readonly logger = new Logger(WorkoutPlannerService.name);

  private workoutPlanSchema = z.object({
    planName: z.string(),
    exercises: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        sets: z.number(),
        reps: z.number(),
        restTime: z.number().optional(),
        equipment: z.string().optional(),
      }),
    ),
    notes: z.string().optional(),
    estimatedDuration: z.number().optional(),
  });

  constructor(
    private readonly database: DatabaseService,
    private readonly aiService: AiService,
    private readonly securityService: SecurityService,
    private readonly auditService: AuditService,
  ) {}

  async handle(data: IntentData): Promise<string> {
    this.logger.debug(`WorkoutPlanner handle for user=${data.userId}`);

    const userId = parseInt(data.userId);
    if (isNaN(userId)) {
      return JSON.stringify({
        type: 'workout_plan',
        plan: null,
        note: 'Invalid user ID',
      });
    }

    try {
      // Fetch user profile with metrics and bookings
      const user = await this.database.user.findUnique({
        where: { userId },
        include: {
          userMetrics: {
            take: 5,
            orderBy: { date: 'desc' },
          },
          ClassBooking: {
            take: 10,
            orderBy: { bookedAt: 'desc' },
            include: { class: true },
          },
        },
      });

      if (!user) {
        return JSON.stringify({
          type: 'workout_plan',
          plan: null,
          note: 'User not found',
        });
      }

      // Minimize user data for privacy before sending to AI
      const minimizedUserData = this.securityService.minimizeUserDataForAI({
        userId: user.userId,
        fitnessLevel: user.fitnessLevel ?? undefined,
        goals: Array.isArray(user.goals)
          ? user.goals.join(', ')
          : (user.goals ?? undefined),
        preferredTimes: Array.isArray(user.preferredTimes)
          ? user.preferredTimes.join(', ')
          : (user.preferredTimes ?? undefined),
        preferredLocations: Array.isArray(user.preferredLocations)
          ? user.preferredLocations.join(', ')
          : (user.preferredLocations ?? undefined),
        classTypes: Array.isArray(user.classTypes)
          ? user.classTypes.join(', ')
          : (user.classTypes ?? undefined),
        priceRange:
          user.priceRange !== undefined
            ? typeof user.priceRange === 'object'
              ? JSON.stringify(user.priceRange)
              : String(user.priceRange)
            : undefined,
        equipmentAtHome: Array.isArray(user.equipmentAtHome)
          ? user.equipmentAtHome.join(', ')
          : (user.equipmentAtHome ?? undefined),
      });

      // Log data access for compliance
      this.auditService.logDataAccess(
        data.userId,
        'user_profile',
        'workout_planning',
        Object.keys(minimizedUserData),
      );

      // Prepare prompt for AI
      const latestMetrics = user.userMetrics?.[0];
      const bmi =
        latestMetrics?.height && latestMetrics?.weight
          ? latestMetrics.weight / (latestMetrics.height / 100) ** 2
          : undefined;

      const prompt = `
        User Profile:
          - Fitness Level: ${typeof minimizedUserData.fitnessLevel === 'string' ? minimizedUserData.fitnessLevel : ''}
          - Goals: ${typeof minimizedUserData.goals === 'string' ? minimizedUserData.goals : ''}
          - Height: ${latestMetrics?.height}
          - Weight: ${latestMetrics?.weight}
          - BMI: ${bmi}
          - Equipment at Home: ${typeof minimizedUserData.equipmentAtHome === 'string' ? minimizedUserData.equipmentAtHome : ''}
        - Injuries: ${user.injuries?.join(', ')}
        - Health Notes: ${user.healthNotes}
        - Preferences: ${JSON.stringify(user.preferences)}
        - Booking History: ${user.ClassBooking?.map(
          (b) =>
            `${b.class?.className} (${b.sessionRating || 'no rating'})${
              b.attended ? ' [attended]' : ''
            }`,
        ).join('; ')}

        User Message: ${data.message}

        Generate a personalized workout plan for this user. Include exercise names, sets, reps, rest times, and equipment if needed. Add notes if there are injuries or health constraints. Return a structured JSON object.
      `;

      const plan = await this.aiService.generateStructuredResponse(
        prompt,
        this.workoutPlanSchema,
      );

      return JSON.stringify({
        type: 'workout_plan',
        plan,
        note: 'Personalized workout plan generated.',
      });
    } catch (error) {
      const errorMsg =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : String(error);
      this.logger.error(`Error in workout planner: ${errorMsg}`);
      return JSON.stringify({
        type: 'workout_plan',
        plan: null,
        note: 'Unable to generate workout plan at this time',
      });
    }
  }
}
