import { Types } from 'mongoose';

/**
 * Usuario validado para auth
 */
export interface ValidatedUser {
  // Id de mongo para firmar token
  _id: Types.ObjectId;
  email: string;
  username: string;
  role: string;
}
