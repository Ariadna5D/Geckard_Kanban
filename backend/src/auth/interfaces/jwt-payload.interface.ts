import { Request } from 'express';

export interface JwtPayload {
  sub: string; // El ID del usuario
  email: string; // El email del usuario
  role: string; // El rol del usuario
}

export interface ValidatedRequest extends Request {
  user: JwtPayload;
}
