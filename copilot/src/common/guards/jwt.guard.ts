import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthRequest {
  headers: { authorization?: string };
  user?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      req.user = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}

/** Same as JwtAuthGuard but does NOT throw — just attaches the user if token is valid. */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        req.user = this.jwt.verify(auth.slice(7));
      } catch {
        // ignore invalid token — treat as unauthenticated
      }
    }
    return true;
  }
}
