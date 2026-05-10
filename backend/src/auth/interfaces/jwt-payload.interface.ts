import { Request } from 'express';

/**
 * Datos del token jwt
 */
export interface JwtPayload {
  // sub guarda id del usuario
  sub: string;
  email: string;
  role: string;
}

/**
 * Usuario en la request autenticada
 */
export interface RequestUser {
  // userId duplica sub por compatibilidad
  sub: string;
  userId: string;
  email: string;
  role: string;
}

/**
 * Request validada por jwt
 */
export interface ValidatedRequest extends Request {
  user: RequestUser;
}
