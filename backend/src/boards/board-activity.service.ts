import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BoardActivityEntityType,
  BoardActivityLog,
  BoardActivityLogDocument,
} from './schemas/board-activity-log.schema';

type RecordBoardActivityInput = {
  boardId: string;
  actorUserId: string;
  actorEmail: string;
  entityType: BoardActivityEntityType;
  action: string;
  message: string;
  entityId?: string;
};

/** Fila `lean` con `actorUserId` posiblemente populado por `populate`. */
type BoardActivityActorPopulated = {
  _id: Types.ObjectId;
  username?: string;
  avatarUrl?: string;
};

type BoardActivityListLeanRow = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  actorUserId: Types.ObjectId | BoardActivityActorPopulated;
  actorEmail: string;
  entityType: BoardActivityEntityType;
  action: string;
  message: string;
  entityId?: string;
  createdAt: Date;
};

@Injectable()
export class BoardActivityService {
  constructor(
    @InjectModel(BoardActivityLog.name)
    private readonly boardActivityModel: Model<BoardActivityLogDocument>,
  ) {}

  async record(input: RecordBoardActivityInput): Promise<void> {
    try {
      await this.boardActivityModel.create({
        boardId: new Types.ObjectId(input.boardId),
        actorUserId: new Types.ObjectId(input.actorUserId),
        actorEmail: input.actorEmail.trim(),
        entityType: input.entityType,
        action: input.action.trim(),
        message: input.message.trim(),
        entityId:
          input.entityId !== undefined && input.entityId.trim().length > 0
            ? input.entityId.trim()
            : undefined,
      });
    } catch (error) {
      // Nunca romper la operación principal por un fallo al registrar actividad.
      console.warn('[board-activity] No se pudo guardar una entrada:', error);
    }
  }

  async listByBoard(boardId: string, limit = 60) {
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    const rows = (await this.boardActivityModel
      .find({ boardId: new Types.ObjectId(boardId) })
      .populate({
        path: 'actorUserId',
        select: 'username avatarUrl',
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(cappedLimit)
      .lean()
      .exec()) as BoardActivityListLeanRow[];

    return rows.map((row) => {
      const actorRef = row.actorUserId;
      const isPopulatedActor =
        actorRef !== null && typeof actorRef === 'object' && '_id' in actorRef;
      const populatedActor = isPopulatedActor
        ? (actorRef as {
            _id: Types.ObjectId;
            username?: string;
            avatarUrl?: string;
          })
        : null;
      const actorUserId = populatedActor
        ? populatedActor._id.toString()
        : (row.actorUserId as Types.ObjectId).toString();
      const actorUsername =
        populatedActor &&
        typeof populatedActor.username === 'string' &&
        populatedActor.username.trim().length > 0
          ? populatedActor.username.trim()
          : undefined;
      const actorAvatarUrl =
        populatedActor &&
        typeof populatedActor.avatarUrl === 'string' &&
        populatedActor.avatarUrl.trim().length > 0
          ? populatedActor.avatarUrl.trim()
          : undefined;

      return {
        _id: row._id.toString(),
        boardId: row.boardId.toString(),
        actorUserId,
        actorUsername,
        actorEmail: row.actorEmail,
        actorAvatarUrl,
        entityType: row.entityType,
        action: row.action,
        message: row.message,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
