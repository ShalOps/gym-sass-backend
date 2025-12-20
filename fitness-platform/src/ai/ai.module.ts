import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai/ai.service';
import { AssistantService } from './assistant/assistant.service';
import { ConversationManagerService } from './conversation-manager/conversation-manager.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { WorkoutPlannerService } from './workout-planner.service';
import { SuggestionEngineService } from './suggestion-engine.service';
import { ProductRecommendationService } from './product-recommendation.service';
import { SearchEngineService } from './search-engine.service';
import { WinstonLoggerService } from './utils/winston-logger.service';
import { CircuitBreakerService } from './utils/circuit-breaker.service';
import { SecurityService } from './utils/security.service';
import { AuditService } from './utils/audit.service';
import { UserContextService } from './utils/user-context.service';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AssistantService,
    ConversationManagerService,
    RecommendationEngineService,
    WorkoutPlannerService,
    SuggestionEngineService,
    ProductRecommendationService,
    SearchEngineService,
    WinstonLoggerService,
    CircuitBreakerService,
    SecurityService,
    AuditService,
    UserContextService,
    AIRateLimitGuard,
  ],
  imports: [
    DatabaseModule,
    ConfigModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: `redis://${configService.get<string>('REDIS_HOST', 'localhost')}:${configService.get<number>('REDIS_PORT', 6379)}`,
          password: configService.get<string>('REDIS_PASSWORD'),
          ttl: (configService.get<number>('REDIS_TTL', 3600) || 3600) * 1000,
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [AssistantService, ConversationManagerService],
})
export class AiModule {}
