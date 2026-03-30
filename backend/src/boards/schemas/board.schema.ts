import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum BoardRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

// 1. SUB-DOCUMENT: Board Member
@Schema({ _id: false })
export class BoardMember {
  // Always specify the exact type and ref for populated fields
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: BoardRole, default: BoardRole.VIEWER })
  role: BoardRole;
}
// We explicitly create the schema for the subdocument
export const BoardMemberSchema = SchemaFactory.createForClass(BoardMember);

// 2. SUB-DOCUMENT: Board Column
@Schema()
export class BoardColumn {
  @Prop({ required: true, trim: true })
  title: string;

  // Array of ObjectIds pointing to the future Task schema
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Task' }] })
  tasks: Types.ObjectId[];
}
// We explicitly create the schema for the column subdocument
export const BoardColumnSchema = SchemaFactory.createForClass(BoardColumn);

// 3. MAIN DOCUMENT: Board
export type BoardDocument = HydratedDocument<Board>;

@Schema({ timestamps: true })
export class Board {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: [BoardMemberSchema], default: [] })
  members: BoardMember[];

  @Prop({ type: [BoardColumnSchema], default: [] })
  columns: BoardColumn[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);
