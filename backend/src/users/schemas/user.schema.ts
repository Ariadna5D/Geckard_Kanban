import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;
export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'pro' | 'team';

@Schema({ timestamps: true })
export class User {
  // Documento base de usuario
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

type PublicUserObject = {
  [key: string]: unknown;
  passwordHash?: string;
};

UserSchema.set('toJSON', {
  transform: (_document, serializedUser) => {
    // Nunca expone hash
    const publicUser: PublicUserObject = { ...serializedUser };
    delete publicUser.passwordHash;
    return publicUser;
  },
});
UserSchema.set('toObject', {
  transform: (_document, serializedUser) => {
    // Tambien limpia hash en objeto plano
    const publicUser: PublicUserObject = { ...serializedUser };
    delete publicUser.passwordHash;
    return publicUser;
  },
});
