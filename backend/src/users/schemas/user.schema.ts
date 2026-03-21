import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;


@Schema({ timestamps: true }) // hacemos que schema añada los timestoamps
export class User { // Entidad usuario
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
  //EXPERIENCIA
  @Prop({ default: 0 }) 
  experiencePoints: number;
}

export const UserSchema = SchemaFactory.createForClass(User);