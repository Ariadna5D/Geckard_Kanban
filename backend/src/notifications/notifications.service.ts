import { Injectable, NotFoundException } from '@nestjs/common';
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

type PopulatedActor = {
  _id: Types.ObjectId;
  username?: string;
  avatarUrl?: string;
};

@Injectable()
export class NotificationsService {
  /**
   * Inyecta modelos y gateway para notificar cambios en tiempo real
   */
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Board.name)
    private readonly boardModel: Model<BoardDocument>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Crea o actualiza una invitacion pendiente para un tablero
   */
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

    // Reusa invitacion pendiente si ya existe para evitar duplicados
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
          returnDocument: 'after',
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    this.notificationsGateway.emitChangedForUser(input.recipientUserId);
  }

  /**
   * Lista notificaciones del usuario ordenadas por fecha descendente
   */
  async listForUser(userId: string, limit = 40) {
    const cappedLimit = Math.min(Math.max(limit, 1), 120);
    // Ordena por fecha desc para mostrar primero lo mas recinete
    const rows = await this.notificationModel
      .find({ recipientUserId: new Types.ObjectId(userId) })
      .populate({ path: 'actorUserId', select: 'username avatarUrl' })
      .sort({ createdAt: -1, _id: -1 })
      .limit(cappedLimit)
      .exec();

    return rows.map((row) => {
      const actorReference = row.actorUserId as unknown;
      let populatedActor: PopulatedActor | null = null;
      if (
        actorReference !== null &&
        typeof actorReference === 'object' &&
        '_id' in actorReference
      ) {
        populatedActor = actorReference as PopulatedActor;
      }

      let actorUserId = row.actorUserId?.toString();
      if (populatedActor !== null) {
        actorUserId = populatedActor._id.toString();
      }

      let readAtIso: string | undefined = undefined;
      if (row.readAt) {
        readAtIso = row.readAt.toISOString();
      }
      let resolvedAtIso: string | undefined = undefined;
      if (row.resolvedAt) {
        resolvedAtIso = row.resolvedAt.toISOString();
      }

      return {
        _id: row._id?.toString(),
        recipientUserId: row.recipientUserId?.toString(),
        actorUserId,
        actorEmail: row.actorEmail,
        actorUsername:
          populatedActor !== null ? populatedActor.username : undefined,
        actorAvatarUrl:
          populatedActor !== null ? populatedActor.avatarUrl : undefined,
        type: row.type,
        status: row.status,
        isRead: row.isRead === true,
        readAt: readAtIso,
        resolvedAt: resolvedAtIso,
        title: row.title,
        message: row.message,
        boardInvite: row.boardInvite
          ? {
              boardId: row.boardInvite.boardId?.toString(),
              boardTitle: row.boardInvite.boardTitle,
              boardSlug: row.boardInvite.boardSlug,
              role: row.boardInvite.role,
            }
          : undefined,
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString(),
      };
    });
  }

  /**
   * Devuelve total de notificaciones no leidas
   */
  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        recipientUserId: new Types.ObjectId(userId),
        isRead: false,
      })
      .exec();
  }

  /**
   * Marca una notificacion como leida
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Solo marca como leida si la notificacion pertenece al usuario
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          recipientUserId: new Types.ObjectId(userId),
        },
        { $set: { isRead: true, readAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Notificacion no encontrada.');
    }
    this.notificationsGateway.emitChangedForUser(userId);
  }

  /**
   * Rechaza una invitacion de tablero pendiente
   */
  async rejectBoardInvite(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    // Solo deja rechazar invitaciones que siguen pendientes
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
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException('Notificacion no existe.');
    }
    this.notificationsGateway.emitChangedForUser(userId);
  }

  /**
   * Acepta una invitacion y agrega el usuario al tablero si corresponde
   */
  async acceptBoardInvite(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    // Busca una invitacion valida y pendiente para este usuario
    const notification = await this.notificationModel
      .findOne({
        _id: new Types.ObjectId(notificationId),
        recipientUserId: new Types.ObjectId(userId),
        type: 'board_invite',
        status: 'pending',
      })
      .exec();
    if (!notification) {
      throw new NotFoundException('Notificacion no existe.');
    }

    const boardId = notification.boardInvite.boardId.toString();
    // Carga tablero para agregar miembro si aun existe
    const board = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .exec();
    if (!board) {
      throw new NotFoundException(
        'El tablero de esta invitacion ya no existe.',
      );
    }

    if (board.owner.toString() !== userId) {
      // Evita duplicar miembro cuando la invitacion se acepta dos veces
      const alreadyMember = board.members.some(
        (member) => member.user.toString() === userId,
      );
      if (!alreadyMember) {
        let role: BoardRole = BoardRole.VIEWER;
        if (notification.boardInvite.role === 'admin') {
          role = BoardRole.ADMIN;
        }
        if (notification.boardInvite.role === 'editor') {
          role = BoardRole.EDITOR;
        }
        if (notification.boardInvite.role === 'viewer') {
          role = BoardRole.VIEWER;
        }
        board.members.push({
          user: new Types.ObjectId(userId),
          role,
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
