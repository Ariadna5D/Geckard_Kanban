import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// 1. Cambiamos Document por HydratedDocument
import { HydratedDocument, Types } from 'mongoose';

export enum BoardRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

@Schema({ _id: false })
export class BoardMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: BoardRole, default: BoardRole.VIEWER })
  role: BoardRole;
}

@Schema()
export class BoardColumn {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }] })
  tasks: Types.ObjectId[];
}

export type BoardDocument = HydratedDocument<Board>;

@Schema({ timestamps: true })
// 3. Quitamos el "extends Document" de la clase
export class Board {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [BoardMember], default: [] })
  members: BoardMember[];

  @Prop({ type: [BoardColumn], default: [] })
  columns: BoardColumn[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);
