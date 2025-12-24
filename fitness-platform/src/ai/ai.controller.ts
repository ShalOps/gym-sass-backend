import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { AssistantService } from './assistant/assistant.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { RecommendationRequestDto } from './dto/recommendation.dto';
import { WorkoutPlanRequestDto } from './dto/workout-plan.dto';
import { SuggestionRequestDto } from './dto/suggestion.dto';
import { ProductRecommendationRequestDto } from './dto/product-recommendation.dto';
import { SearchRequestDto } from './dto/search.dto';
import { AIFeedbackDto } from './dto/ai-feedback.dto';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIRateLimitGuard } from './guards/ai-rate-limit.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
@UseGuards(JwtAuthGuard, AIRateLimitGuard)
export class AiController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat/message')
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  @ApiBody({ type: ChatMessageDto })
  @ApiResponse({ status: 200, description: 'AI response message.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async handleMessage(@Body() body: ChatMessageDto) {
    // TODO: Fetch userTier from subscription service
    const userTier = 'premium'; // Placeholder
    const result = await this.assistant.processMessage(
      body.userId,
      body.message,
      body.conversationId,
      userTier,
    );

    return { message: result };
  }

  @Sse('chat/message/stream')
  @ApiOperation({
    summary: 'Send a message to the AI assistant with streaming response',
  })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({ name: 'message', type: String, description: 'Message content' })
  @ApiQuery({
    name: 'conversationId',
    type: String,
    required: false,
    description: 'Optional conversation ID',
  })
  @ApiResponse({ status: 200, description: 'Streaming AI response.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  handleMessageStream(@Query() query: ChatMessageDto): Observable<any> {
    return new Observable((observer) => {
      void (async () => {
        try {
          const userTier = 'premium'; // TODO: Fetch from subscription
          const stream = await this.assistant.processMessageStream(
            query.userId,
            query.message,
            query.conversationId,
            userTier,
          );

          for await (const chunk of stream) {
            // Safely extract text property if it exists
            const text =
              typeof chunk === 'object' && chunk !== null && 'text' in chunk
                ? ((chunk as { text?: string }).text ?? '')
                : '';
            observer.next({ data: { text } });
          }

          observer.next({ data: { done: true } });
          observer.complete();
        } catch (error: unknown) {
          observer.error(error);
        }
      })();
    });
  }

  @Get('recommend')
  @ApiOperation({ summary: 'Get personalized recommendations' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({
    name: 'categories',
    type: [String],
    required: false,
    description: 'Categories to filter',
  })
  @ApiQuery({
    name: 'location',
    type: String,
    required: false,
    description: 'Location filter',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Result limit',
  })
  @ApiOkResponse({ description: 'Personalized recommendations.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async getRecommendations(@Query() query: RecommendationRequestDto) {
    return this.assistant.getRecommendations(query.userId, query);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Get a personalized workout plan' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({
    name: 'fitnessLevel',
    type: String,
    required: false,
    description: 'Fitness level',
  })
  @ApiQuery({
    name: 'goals',
    type: [String],
    required: false,
    description: 'Fitness goals',
  })
  @ApiQuery({
    name: 'duration',
    type: Number,
    required: false,
    description: 'Workout duration',
  })
  @ApiOkResponse({ description: 'Personalized workout plan.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async getWorkoutPlan(@Query() query: WorkoutPlanRequestDto) {
    return this.assistant.getWorkoutPlan(query.userId, query);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Get suggestions for gyms, classes, or trainers' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({
    name: 'type',
    enum: ['gym', 'class', 'trainer'],
    description: 'Type of suggestion',
  })
  @ApiQuery({
    name: 'location',
    type: String,
    required: false,
    description: 'Location filter',
  })
  @ApiOkResponse({ description: 'Suggestions based on user preferences.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async getSuggestions(@Query() query: SuggestionRequestDto) {
    return this.assistant.getSuggestions(query.userId, query);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get product recommendations' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({
    name: 'goals',
    type: [String],
    required: false,
    description: 'Fitness goals',
  })
  @ApiOkResponse({ description: 'Product recommendations.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async getProductRecommendations(
    @Query() query: ProductRecommendationRequestDto,
  ) {
    return this.assistant.getProductRecommendations(query.userId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Perform natural language search' })
  @ApiQuery({ name: 'userId', type: String, description: 'User ID' })
  @ApiQuery({ name: 'query', type: String, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Result limit',
  })
  @ApiOkResponse({ description: 'Search results.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async search(@Query() query: SearchRequestDto) {
    return this.assistant.search(query.userId, query);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit feedback for AI responses' })
  @ApiBody({ type: AIFeedbackDto })
  @ApiResponse({ status: 201, description: 'Feedback submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async submitFeedback(@Body() body: AIFeedbackDto) {
    await this.assistant.submitFeedback(body.userId, body);
    return { message: 'Feedback submitted successfully' };
  }
}
