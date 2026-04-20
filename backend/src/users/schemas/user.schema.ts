import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;
export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'pro' | 'team';

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

  @Prop({
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  })
  role: UserRole;

  // PLAN SUBSCRIPCION
  @Prop({
    type: String,
    enum: ['free', 'pro', 'team'],
    default: 'free',
  })
  userPlan: UserPlan;

  @Prop({
    type: String,
    required: false,
    default: null,
  })
  stripeCustomerId: string | null;

  @Prop({
    type: String,
    required: false,
    default: null,
  })
  stripeSubscriptionId: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    delete plain.passwordHash;
    return plain;
  },
});
UserSchema.set('toObject', {
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    delete plain.passwordHash;
    return plain;
  },
});
