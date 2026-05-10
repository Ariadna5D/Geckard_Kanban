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

type BoardActivityListLeanRow = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  actorUserId:
    | Types.ObjectId
    | { _id: Types.ObjectId; username?: string; avatarUrl?: string };
  actorEmail: string;
  entityType: BoardActivityEntityType;
  action: string;
  message: string;
  entityId?: string;
  createdAt: Date;
};

type ActivityActorData = {
  _id: Types.ObjectId;
  username?: string;
  avatarUrl?: string;
};

@Injectable()
export class BoardActivityService {
  /**
   * Inyecta el modelo de actividad para guardar y leer eventos
   */
  constructor(
    @InjectModel(BoardActivityLog.name)
    private readonly boardActivityModel: Model<BoardActivityLogDocument>,
  ) {}

  /**
   * Guarda un evento de actividad del tablero
   */
  async record(input: RecordBoardActivityInput): Promise<void> {
    try {
      // Si llega entityId vacio lo guardamos como undefined
      let normalizedEntityId: string | undefined = undefined;
      if (input.entityId !== undefined && input.entityId.trim().length > 0) {
        normalizedEntityId = input.entityId.trim();
      }
      await this.boardActivityModel.create({
        boardId: new Types.ObjectId(input.boardId),
        actorUserId: new Types.ObjectId(input.actorUserId),
        actorEmail: input.actorEmail.trim(),
        entityType: input.entityType,
        action: input.action.trim(),
        message: input.message.trim(),
        entityId: normalizedEntityId,
      });
    } catch {
      // La actividad nunca debe romper el flujo principal
      return;
    }
  }

  /**
   * Lista actividad reciente ordenada de mas nueva a mas antigua
   */
  async listByBoard(boardId: string, limit = 60) {
    const cappedLimit = Math.min(Math.max(limit, 1), 200);
    // Carga actor populado para mostrar username y avatar en el feed
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

    // Recorre filas y normaliza la respuesta final
    return rows.map((row) => {
      const actorReference = row.actorUserId;
      let actorUserId = '';
      let actorUsername: string | undefined = undefined;
      let actorAvatarUrl: string | undefined = undefined;

      // Cuando llega documento populado usa sus campos directos
      if (
        actorReference !== null &&
        typeof actorReference === 'object' &&
        '_id' in actorReference
      ) {
        const data = actorReference as ActivityActorData;
        actorUserId = data._id.toString();
        if (
          typeof data.username === 'string' &&
          data.username.trim().length > 0
        ) {
          actorUsername = data.username.trim();
        }
        if (
          typeof data.avatarUrl === 'string' &&
          data.avatarUrl.trim().length > 0
        ) {
          actorAvatarUrl = data.avatarUrl.trim();
        }
      } else {
        // Cuando llega object id simple convierte a string
        actorUserId = String(actorReference);
      }

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
