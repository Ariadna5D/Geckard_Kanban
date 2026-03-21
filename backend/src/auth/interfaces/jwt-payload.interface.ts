import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface ValidatedRequest extends Request {
  user: JwtPayload;
}
