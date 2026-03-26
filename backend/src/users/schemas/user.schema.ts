import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

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
  //ROL
  @Prop({ default: 'user' })
  role: string;
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
}

export const UserSchema = SchemaFactory.createForClass(User);
