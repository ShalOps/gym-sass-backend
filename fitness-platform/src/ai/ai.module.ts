import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai/ai.service';
import { AssistantService } from './assistant/assistant.service';
import { ConversationManagerService } from './conversation-manager/conversation-manager.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { WorkoutPlannerService } from './workout-planner.service';
import { SuggestionEngineService } from './suggestion-engine.service';
import { ProductRecommendationService } from './product-recommendation.service';
import { SearchEngineService } from './search-engine.service';

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
  ],
  exports: [AssistantService, ConversationManagerService],
})
export class AiModule {}
