import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { DatabaseService } from '../../database/database.service';
import {
  AuthenticatedUser,
  MaybeAuthenticatedSocket,
} from '../types/authenticated-socket.type';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('!!! DEBUG: WsJwtGuard.canActivate triggered');
    try {
      const client = context.switchToWs().getClient<MaybeAuthenticatedSocket>();

      // If the user has already been authenticated, for example by handleConnection, proceed without further verification.
      if (client.data?.user?.email) {
        console.log(
          '!!! DEBUG: WsJwtGuard passed (existing user)',
          client.data.user.userId,
        );
        return true;
      }

      // Otherwise, verify token
      const token = this.extractToken(client);

      if (!token) {
        throw new UnauthorizedException('Unauthorized: No token provided');
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const verified = await this.jwtService.verifyAsync<{
        sub?: number;
        userId?: number;
        role: string;
        email?: string;
      }>(token, {
        secret,
      });

      const userId = Number(verified.sub || verified.userId);
      // Construct user object with optional email from JWT
      const user = {
        userId,
        role: String(verified.role),
        email: verified.email,
      } as AuthenticatedUser;

      // Fallback to database if email is missing from JWT
      if (!verified.email) {
        const dbUser = await this.db.user.findUnique({
          where: { userId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (dbUser) {
          user.email = dbUser.email;
          user.firstName = dbUser.firstName;
          user.lastName = dbUser.lastName;
        }
      }

      client.data.user = user;

      console.log('!!! DEBUG: WsJwtGuard passed for user', userId);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('!!! DEBUG: WsJwtGuard failed', message);
      this.logger.warn(`Authentication failed: ${message}`);
      throw new WsException('Unauthorized: Invalid token');
    }
  }

  private extractToken(client: MaybeAuthenticatedSocket): string | undefined {
    // Check handshake auth object (standard Socket.io v4)
    if (client.handshake.auth?.token) {
      return String(client.handshake.auth.token);
    }

    // Check headers (common fallback)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }

    // Strictly For Testing Only: Check query params (only in development/testing - less secure)
    const enableQueryAuth =
      this.configService.get<string>('ENABLE_QUERY_AUTH') === 'true';

    if (enableQueryAuth && client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return undefined;
  }
}
