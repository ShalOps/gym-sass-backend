import { Injectable, Logger } from '@nestjs/common';
import { IntentHandler, IntentData } from './intent-handler.interface';
import { DatabaseService } from '../database/database.service';
import { AiService } from './ai/ai.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { UserContextService } from './utils/user-context.service';
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
    private readonly userContext: UserContextService,
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
      // Get user context from cache or DB
      const user = await this.userContext.getUserContext(data.userId);

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
        fitnessLevel: user.fitnessLevel,
        goals: user.goals?.join(', '),
        preferredTimes: user.preferredTimes?.join(', '),
        preferredLocations: user.preferredLocations?.join(', '),
        classTypes: user.classTypes?.join(', '),
        priceRange: user.priceRange
          ? JSON.stringify(user.priceRange)
          : undefined,
        equipmentAtHome: user.equipmentAtHome?.join(', '),
      });

      // Log data access for compliance
      this.auditService.logDataAccess(
        data.userId,
        'user_profile',
        'workout_planning',
        Object.keys(minimizedUserData),
      );

      // Prepare prompt for AI
      const bmi = user.latestMetrics?.bmi;

      const prompt = `
        User Profile:
          - Fitness Level: ${typeof minimizedUserData.fitnessLevel === 'string' ? minimizedUserData.fitnessLevel : ''}
          - Goals: ${typeof minimizedUserData.goals === 'string' ? minimizedUserData.goals : ''}
          - Height: ${user.latestMetrics?.height}
          - Weight: ${user.latestMetrics?.weight}
          - BMI: ${bmi}
          - Equipment at Home: ${typeof minimizedUserData.equipmentAtHome === 'string' ? minimizedUserData.equipmentAtHome : ''}
        - Injuries: ${user.injuries?.join(', ')}
        - Health Notes: ${user.healthNotes}
        - Preferences: ${JSON.stringify(user.preferences)}
        - Booking History: ${user.recentBookings
          .map(
            (b) =>
              `${b.className} (${b.sessionRating || 'no rating'})${
                b.attended ? ' [attended]' : ''
              }`,
          )
          .join('; ')}

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
