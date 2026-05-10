import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  JwtPayload,
  RequestUser,
} from '../interfaces/jwt-payload.interface';

/**
 * Estrategia jwt
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Lee secret jwt y configura token bearer
   */
  constructor(configService: ConfigService) {
    const secretRaw = configService.get<string>('JWT_SECRET');
    let secret = '';
    if (secretRaw !== undefined && secretRaw !== null) {
      secret = secretRaw.trim();
    }
    if (secret === '') {
      throw new Error('JWT_SECRET es obligatoria.');
    }
    // Configura passport para leer token
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Devuelve usuario para la request
   */
  validate(payload: JwtPayload): RequestUser {
    if (payload === undefined || payload === null) {
      throw new UnauthorizedException();
    }
    // Devuelve datos minimos para usar permisos en cada request
    const userId = payload.sub;
    return {
      sub: userId,
      userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
