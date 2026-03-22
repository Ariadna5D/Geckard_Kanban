import { Types } from 'mongoose';

export interface ValidatedUser {
  _id: Types.ObjectId; // El ID de MongoDB es un ObjectId
  email: string; // El email del usuario
  username: string; // El nombre de usuario
  role: string; // El rol del usuario
}
