import { Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerRequest,
} from '@nestjs/throttler';
import { MaybeAuthenticatedSocket } from '../types/authenticated-socket.type';

interface SocketWithConn {
  conn?: {
    remoteAddress?: string;
  };
}

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, generateKey } =
      requestProps;

    const client = context.switchToWs().getClient<MaybeAuthenticatedSocket>();
    const tracker = await this.getTracker(client);
    const key = generateKey(context, tracker, throttler.name || 'default');

    const { totalHits } = await this.storageService.increment(
      key,
      ttl,
      limit,
      blockDuration,
      throttler.name || 'default',
    );

    if (totalHits > limit) {
      throw new ThrottlerException();
    }

    return true;
  }

  protected getTracker(socket: MaybeAuthenticatedSocket): Promise<string> {
    const socketWithConn = socket as unknown as SocketWithConn;

    // Prefer User ID if authenticated
    if (socket.data?.user?.userId) {
      return Promise.resolve(`ws-user-${socket.data.user.userId}`);
    }

    // Fallback to IP
    const ip =
      socket.handshake?.address ||
      socketWithConn.conn?.remoteAddress ||
      'unknown-ws-client';

    return Promise.resolve(ip);
  }
}
