import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  JwtPayload,
  RequestUser,
} from '../interfaces/jwt-payload.interface';

/**
 * Estrategia de Passport para validar JWT en rutas protegidas. Lee el secreto de JWT_SECRET.
 * Si el token es válido, Passport guarda el payload decodificado en req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secretRaw = configService.get<string>('JWT_SECRET'); // Lee el secreto de JWT_SECRET
    let secret = '';
    if (secretRaw !== undefined && secretRaw !== null) {
      secret = secretRaw.trim();
    }
    if (secret === '') {
      throw new Error('JWT_SECRET es obligatoria para validar tokens.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrae el token del header Authorization: Bearer ...
      ignoreExpiration: false, // No ignores la expiración del token
      secretOrKey: secret, // Usa el secreto para verificar la firma del token
    });
  }

  /**
   * Passport llama aquí si la firma y la fecha del token son correctas.
   * El objeto devuelto se guarda en req.user.
   */
  validate(payload: JwtPayload): RequestUser {
    if (payload === undefined || payload === null) {
      throw new UnauthorizedException();
    }
    const userId = payload.sub;
    return {
      sub: userId,
      userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
