import { Socket } from 'socket.io';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedUser;
  };
}

// The "Transitional" state: A socket that might not have a user yet (for Guards)
export interface MaybeAuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
  };
}
