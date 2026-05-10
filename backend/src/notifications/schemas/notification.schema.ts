import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BoardRole } from '../../boards/schemas/board.schema';

export type NotificationDocument = HydratedDocument<Notification>;

export type NotificationType = 'board_invite';
export type NotificationStatus = 'pending' | 'accepted' | 'rejected';
export type NotificationInviteRole = 'admin' | 'editor' | 'viewer';

@Schema({ _id: false })
export class NotificationBoardInvitePayload {
  // Tablero invitado
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true })
  boardId: Types.ObjectId;

  // Titulo visible del tablero
  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  boardTitle: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 80 })
  boardSlug: string;

  @Prop({
    type: String,
    enum: [BoardRole.ADMIN, BoardRole.EDITOR, BoardRole.VIEWER],
    required: true,
  })
  role: NotificationInviteRole;
}

export const NotificationBoardInvitePayloadSchema =
  SchemaFactory.createForClass(NotificationBoardInvitePayload);

@Schema({ timestamps: true })
export class Notification {
  // Usuario que recibe la notificacion
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientUserId: Types.ObjectId;

  // Usuario que provoca el evento
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorUserId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  actorEmail: string;

  @Prop({ type: String, required: true, enum: ['board_invite'], index: true })
  type: NotificationType;

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  })
  status: NotificationStatus;

  // Estado de lectura
  @Prop({ type: Boolean, required: true, default: false, index: true })
  isRead: boolean;

  @Prop({ type: Date, required: false })
  readAt?: Date;

  // Momento de aceptar o rechazar
  @Prop({ type: Date, required: false })
  resolvedAt?: Date;

  @Prop({ type: String, required: true, trim: true, maxlength: 140 })
  title: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 300 })
  message: string;

  // Datos extra de board_invite
  @Prop({ type: NotificationBoardInvitePayloadSchema, required: true })
  boardInvite: NotificationBoardInvitePayload;

  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
