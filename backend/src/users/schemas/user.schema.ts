import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;
export type UserRole = 'user' | 'admin';

@Schema({ timestamps: true }) // hacemos que schema añada los timestamps
// Entidad usuario
export class User {
  //USERNAME
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  //EMAIL
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  //PASSWORD (Hasheado)
  @Prop({ required: true })
  passwordHash: string;

  //BIO
  @Prop({
    required: false,
    default: '',
    trim: true,
  })
  bio: string;

  //AVATAR
  @Prop({
    required: false,
    default: '',
  })
  avatarUrl: string;

  //EXPERIENCIA
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
