import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from './winston-logger.service';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class CircuitBreakerService {
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minute
  private readonly states: Map<string, CircuitBreakerState> = new Map();

  constructor(private logger: WinstonLoggerService) {}

  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const state = this.getState(key);

    if (state.state === 'OPEN') {
      if (Date.now() - state.lastFailureTime > this.recoveryTimeout) {
        state.state = 'HALF_OPEN';
        this.logger.warn(`Circuit breaker for ${key} entering HALF_OPEN state`);
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${key}. AI features temporarily disabled.`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess(key);
      return result;
    } catch (error) {
      this.onFailure(key, error);
      throw error;
    }
  }

  private getState(key: string): CircuitBreakerState {
    if (!this.states.has(key)) {
      this.states.set(key, {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED',
      });
    }
    return this.states.get(key)!;
  }

  private onSuccess(key: string) {
    const state = this.getState(key);
    state.failures = 0;
    state.state = 'CLOSED';
  }

  private onFailure(key: string, error: any) {
    const state = this.getState(key);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.failureThreshold) {
      state.state = 'OPEN';
      this.logger.error(
        `Circuit breaker for ${key} opened due to ${state.failures} failures`,
        {
          error:
            typeof error === 'object' && error !== null && 'message' in error
              ? (error as { message: string }).message
              : String(error),
          key,
        },
      );
    }
  }
}
