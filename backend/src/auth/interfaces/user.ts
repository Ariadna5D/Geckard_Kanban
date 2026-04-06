import { Types } from 'mongoose';

/**
 * Usuario tal como lo usamos tras el login: datos básicos, sin contraseña.
 */
export interface ValidatedUser {
  _id: Types.ObjectId;
  email: string;
  username: string;
  role: string;
}
