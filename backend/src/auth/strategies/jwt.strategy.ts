// src/auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // 1. Le decimos a Passport dónde buscar el token. 
      // El estándar es mandarlo en el header como: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // 2. Queremos que rechace tokens caducados automáticamente.
      ignoreExpiration: false,
      
      // 3. La misma clave que usaste en auth.module.ts para firmarlo.
      secretOrKey: 'tu_clave_secreta_super_segura', 
    });
  }

  // 4. Este método SOLO se ejecuta si la firma del token es válida y no ha caducado.
  // Passport nos pasa el 'payload' (los datos que metimos al hacer login).
  async validate(payload: any) {
    // Lo que devolvamos aquí, NestJS lo guardará en 'req.user'.
    // Así, en cualquier controlador sabrás qué usuario está haciendo la petición.
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role // Fundamental para tu futuro sistema de permisos
    };
  }
}