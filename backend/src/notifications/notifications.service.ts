import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardDocument,
  BoardRole,
} from '../boards/schemas/board.schema';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Board.name)
    private readonly boardModel: Model<BoardDocument>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createBoardInvite(input: {
    recipientUserId: string;
    actorUserId: string;
    actorEmail: string;
    boardId: string;
    boardTitle: string;
    boardSlug: string;
    role: BoardRole.ADMIN | BoardRole.EDITOR | BoardRole.VIEWER;
  }): Promise<void> {
    const recipientObjectId = new Types.ObjectId(input.recipientUserId);
    const boardObjectId = new Types.ObjectId(input.boardId);

    await this.notificationModel
      .findOneAndUpdate(
        {
          recipientUserId: recipientObjectId,
          type: 'board_invite',
          status: 'pending',
          'boardInvite.boardId': boardObjectId,
        },
        {
          $set: {
            actorUserId: new Types.ObjectId(input.actorUserId),
            actorEmail: input.actorEmail.trim(),
            title: 'Invitación a tablero',
            message: `Te han invitado al tablero «${input.boardTitle}» como ${input.role}.`,
            boardInvite: {
              boardId: boardObjectId,
              boardTitle: input.boardTitle.trim(),
              boardSlug: input.boardSlug.trim(),
              role: input.role,
            },
            isRead: false,
            readAt: null,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    this.notificationsGateway.emitChangedForUser(input.recipientUserId);
  }

  async listForUser(userId: string, limit = 40) {
    const cappedLimit = Math.min(Math.max(limit, 1), 120);
    const rows = await this.notificationModel
      .find({ recipientUserId: new Types.ObjectId(userId) })
      .populate({ path: 'actorUserId', select: 'username avatarUrl' })
      .sort({ createdAt: -1, _id: -1 })
      .limit(cappedLimit)
      .exec();

    return rows.map((row) => {
      const actorRef = row.actorUserId as unknown;
      const isPopulatedActor =
        typeof actorRef === 'object' &&
        actorRef !== null &&
        '_id' in (actorRef as Record<string, unknown>);
      const populatedActor = isPopulatedActor
        ? (actorRef as {
            _id: Types.ObjectId;
            username?: string;
            avatarUrl?: string;
          })
        : null;
      const actorUserId = isPopulatedActor
        ? populatedActor?._id.toString() ?? row.actorUserId.toString()
        : row.actorUserId.toString();

      return {
        _id: row._id.toString(),
        recipientUserId: row.recipientUserId.toString(),
        actorUserId,
        actorEmail: row.actorEmail,
        actorUsername: populatedActor?.username,
        actorAvatarUrl: populatedActor?.avatarUrl,
        type: row.type,
        status: row.status,
        isRead: row.isRead === true,
        readAt: row.readAt ? row.readAt.toISOString() : undefined,
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : undefined,
        title: row.title,
        message: row.message,
        boardInvite: {
          boardId: row.boardInvite.boardId.toString(),
          boardTitle: row.boardInvite.boardTitle,
          boardSlug: row.boardInvite.boardSlug,
          role: row.boardInvite.role,
        },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        recipientUserId: new Types.ObjectId(userId),
        isRead: false,
      })
      .exec();
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          recipientUserId: new Types.ObjectId(userId),
        },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Notificación no encontrada.');
    }
    this.notificationsGateway.emitChangedForUser(userId);
  }

  async rejectBoardInvite(notificationId: string, userId: string): Promise<void> {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          recipientUserId: new Types.ObjectId(userId),
          type: 'board_invite',
          status: 'pending',
        },
        {
          $set: {
            status: 'rejected',
            isRead: true,
            readAt: new Date(),
            resolvedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(
        'No se encontró una invitación pendiente con ese id.',
      );
    }
    this.notificationsGateway.emitChangedForUser(userId);
  }

  async acceptBoardInvite(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationModel
      .findOne({
        _id: new Types.ObjectId(notificationId),
        recipientUserId: new Types.ObjectId(userId),
        type: 'board_invite',
        status: 'pending',
      })
      .exec();
    if (!notification) {
      throw new NotFoundException(
        'No se encontró una invitación pendiente con ese id.',
      );
    }

    const boardId = notification.boardInvite.boardId.toString();
    const board = await this.boardModel.findById(new Types.ObjectId(boardId)).exec();
    if (!board) {
      throw new NotFoundException('El tablero de esta invitación ya no existe.');
    }

    if (board.owner.toString() !== userId) {
      let alreadyMember = false;
      for (let i = 0; i < board.members.length; i++) {
        if (board.members[i].user.toString() === userId) {
          alreadyMember = true;
          break;
        }
      }
      if (!alreadyMember) {
        board.members.push({
          user: new Types.ObjectId(userId),
          role: notification.boardInvite.role,
        });
        await board.save();
      }
    }

    notification.status = 'accepted';
    notification.isRead = true;
    notification.readAt = new Date();
    notification.resolvedAt = new Date();
    await notification.save();
    this.notificationsGateway.emitChangedForUser(userId);
  }
}
