import { Request } from 'express';

/**
 * Payload del JWT: lo que se firma en el token y se decodifica en JwtStrategy.validate.
 */
export interface JwtPayload {
  sub: string; // El id de Mongo del usuario, como string
  email: string; // El email del usuario
  role: string; // El rol del usuario
}

/**
 * Forma de req.user después de JwtStrategy.validate.
 * sub y userId repiten el mismo id de Mongo en string (por comodidad en controladores).
 */
export interface RequestUser {
  sub: string;
  userId: string;
  email: string;
  role: string;
}

/** Petición HTTP donde ya pasó JwtAuthGuard y existe req.user. */
export interface ValidatedRequest extends Request {
  user: RequestUser;
}
