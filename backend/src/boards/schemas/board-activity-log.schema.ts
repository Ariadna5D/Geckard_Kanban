import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BoardActivityLogDocument = HydratedDocument<BoardActivityLog>;

export type BoardActivityEntityType =
  | 'board'
  | 'column'
  | 'task'
  | 'sprint'
  | 'member';

@Schema({ timestamps: false })
export class BoardActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorUserId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  actorEmail: string;

  @Prop({
    type: String,
    required: true,
    enum: ['board', 'column', 'task', 'sprint', 'member'],
  })
  entityType: BoardActivityEntityType;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  action: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 400 })
  message: string;

  @Prop({ type: String, required: false, trim: true, maxlength: 80 })
  entityId?: string;

  @Prop({ type: Date, required: true, default: Date.now, index: true })
  createdAt: Date;
}

export const BoardActivityLogSchema =
  SchemaFactory.createForClass(BoardActivityLog);

BoardActivityLogSchema.index({ boardId: 1, createdAt: -1 });
