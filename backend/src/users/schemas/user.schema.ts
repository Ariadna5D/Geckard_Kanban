import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;
export type UserRole = 'user' | 'admin';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({
    required: false,
    default: '',
    trim: true,
  })
  bio: string;

  @Prop({
    required: false,
    default: '',
  })
  avatarUrl: string;

  @Prop({ default: 0 })
  experiencePoints: number;

  @Prop({
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
