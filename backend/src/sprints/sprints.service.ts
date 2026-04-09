import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sprint, SprintDocument } from './schemas/sprint.schema';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { BoardsService } from '../boards/boards.service';
import { BoardRole } from '../boards/schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';

// DTOs y tipos relacionados con sprints, para mantener el servicio organizado. No se exportan fuera de aquí.
export interface SprintForClient {
  _id: string;
  boardId: string;
  name: string;
  goal?: string;
  startsAt?: string;
  endsAt?: string;
  status: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// Tipo para operaciones de actualización masiva del orden de los sprints, usado internamente.
type SprintDisplayOrderBulkOp = {
  updateOne: {
    filter: { _id: Types.ObjectId; boardId: Types.ObjectId };
    update: { $set: { displayOrder: number } };
  };
};

// Tipo para representar un sprint tal como está en la base de datos, con campos de fecha como Date y sin convertir ObjectId a string. Usado internamente para mapear a SprintForClient.
type SprintLeanRow = {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  name: string;
  goal?: string;
  startsAt?: Date;
  endsAt?: Date;
  status: string;
  displayOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class SprintsService {
  constructor(
    @InjectModel(Sprint.name)
    private readonly sprintModel: Model<SprintDocument>,
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
    private readonly boardsService: BoardsService,
  ) {}

  private mapSprintForClient(doc: SprintLeanRow): SprintForClient {
    let startsAtIso: string | undefined;
    if (doc.startsAt !== undefined && doc.startsAt !== null) {
      startsAtIso = doc.startsAt.toISOString();
    }
    let endsAtIso: string | undefined;
    if (doc.endsAt !== undefined && doc.endsAt !== null) {
      endsAtIso = doc.endsAt.toISOString();
    }
    let createdAtIso: string | undefined;
    if (doc.createdAt !== undefined && doc.createdAt !== null) {
      createdAtIso = doc.createdAt.toISOString();
    }
    let updatedAtIso: string | undefined;
    if (doc.updatedAt !== undefined && doc.updatedAt !== null) {
      updatedAtIso = doc.updatedAt.toISOString();
    }
    let displayOrder = 0;
    if (doc.displayOrder !== undefined && doc.displayOrder !== null) {
      displayOrder = doc.displayOrder;
    }
    return {
      _id: doc._id.toString(),
      boardId: doc.boardId.toString(),
      name: doc.name,
      goal: doc.goal,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      status: doc.status,
      displayOrder,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
    };
  }

  private async nextDisplayOrder(
    boardObjectId: Types.ObjectId,
  ): Promise<number> {
    const lastSprintRow = await this.sprintModel
      .findOne({ boardId: boardObjectId })
      .sort({ displayOrder: -1 })
      .select('displayOrder')
      .lean()
      .exec();
    let lastOrder = -1;
    if (lastSprintRow !== undefined && lastSprintRow !== null) {
      const row = lastSprintRow as { displayOrder?: number };
      if (row.displayOrder !== undefined && row.displayOrder !== null) {
        lastOrder = row.displayOrder;
      }
    }
    return lastOrder + 1;
  }

  async findByBoard(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient[]> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    const sprintRows = await this.sprintModel
      .find({ boardId: new Types.ObjectId(boardId) })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean()
      .exec();
    const resultForClient: SprintForClient[] = [];
    for (let rowIndex = 0; rowIndex < sprintRows.length; rowIndex++) {
      const rowDocument = sprintRows[rowIndex] as SprintLeanRow;
      resultForClient.push(this.mapSprintForClient(rowDocument));
    }
    return resultForClient;
  }

  async create(
    boardId: string,
    dto: CreateSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const makeActive = dto.makeActive !== false;
    const closePrevious = dto.closePreviousActive !== false;

    if (makeActive && closePrevious) {
      await this.sprintModel
        .updateMany(
          { boardId: boardObjectId, status: 'active' },
          { $set: { status: 'completed' } },
        )
        .exec();
    }

    const displayOrder = await this.nextDisplayOrder(boardObjectId);

    let goalText: string | undefined;
    if (dto.goal !== undefined && dto.goal !== null) {
      const trimmedGoal = dto.goal.trim();
      if (trimmedGoal !== '') {
        goalText = trimmedGoal;
      }
    }

    const created = await this.sprintModel.create({
      boardId: boardObjectId,
      name: dto.name.trim(),
      goal: goalText,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      status: makeActive ? 'active' : 'completed',
      displayOrder,
    });

    return this.mapSprintForClient(created.toObject() as SprintLeanRow);
  }

  async complete(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const updated = await this.sprintModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(sprintId),
          boardId: new Types.ObjectId(boardId),
        },
        { $set: { status: 'completed' } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Sprint no encontrado en este tablero.');
    }

    return this.mapSprintForClient(updated.toObject() as SprintLeanRow);
  }

  async reopen(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const sprintDocument = await this.sprintModel
      .findOne({
        _id: new Types.ObjectId(sprintId),
        boardId: new Types.ObjectId(boardId),
      })
      .exec();

    if (!sprintDocument) {
      throw new NotFoundException('Sprint no encontrado en este tablero.');
    }
    if (sprintDocument.status !== 'completed') {
      throw new BadRequestException('Solo se puede reabrir un sprint cerrado.');
    }

    await this.sprintModel
      .updateMany(
        { boardId: new Types.ObjectId(boardId), status: 'active' },
        { $set: { status: 'completed' } },
      )
      .exec();

    sprintDocument.status = 'active';
    await sprintDocument.save();

    return this.mapSprintForClient(sprintDocument.toObject() as SprintLeanRow);
  }

  async setActive(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const targetSprint = await this.sprintModel
      .findOne({
        _id: new Types.ObjectId(sprintId),
        boardId: new Types.ObjectId(boardId),
      })
      .exec();

    if (!targetSprint) {
      throw new NotFoundException('Sprint no encontrado en este tablero.');
    }
    if (targetSprint.status === 'completed') {
      throw new ForbiddenException(
        'No puedes activar un sprint cerrado. Pide a un administrador del tablero que lo reabra.',
      );
    }

    await this.sprintModel
      .updateMany(
        {
          boardId: new Types.ObjectId(boardId),
          status: 'active',
          _id: { $ne: targetSprint._id },
        },
        { $set: { status: 'completed' } },
      )
      .exec();

    const refreshed = await this.sprintModel.findById(targetSprint._id).exec();
    if (!refreshed) {
      throw new NotFoundException('Sprint no encontrado en este tablero.');
    }
    return this.mapSprintForClient(refreshed.toObject() as SprintLeanRow);
  }

  async reorder(
    boardId: string,
    sprintIdsOrdered: string[],
    userId: string,
    isAppAdmin = false,
  ): Promise<SprintForClient[]> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const existingIdRows = await this.sprintModel
      .find({ boardId: boardObjectId })
      .select('_id')
      .lean()
      .exec();
    const validSprintIdSet = new Set<string>();
    for (let index = 0; index < existingIdRows.length; index++) {
      validSprintIdSet.add(existingIdRows[index]._id.toString());
    }
    if (sprintIdsOrdered.length !== validSprintIdSet.size) {
      throw new BadRequestException(
        'La lista debe incluir todos los sprints del tablero, sin duplicados.',
      );
    }
    for (let index = 0; index < sprintIdsOrdered.length; index++) {
      const candidateId = sprintIdsOrdered[index];
      if (!validSprintIdSet.has(candidateId)) {
        throw new BadRequestException(
          'Id de sprint inválido para este tablero.',
        );
      }
    }

    const bulkReorderOps: SprintDisplayOrderBulkOp[] = [];
    for (let position = 0; position < sprintIdsOrdered.length; position++) {
      bulkReorderOps.push({
        updateOne: {
          filter: {
            _id: new Types.ObjectId(sprintIdsOrdered[position]),
            boardId: boardObjectId,
          },
          update: { $set: { displayOrder: position } },
        },
      });
    }
    await this.sprintModel.bulkWrite(bulkReorderOps);

    return this.findByBoard(boardId, userId, isAppAdmin);
  }

  async remove(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.boardsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    await this.boardsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);
    const deleteResult = await this.sprintModel
      .deleteOne({ _id: sprintObjectId, boardId: boardObjectId })
      .exec();
    if (deleteResult.deletedCount === 0) {
      throw new NotFoundException('Sprint no encontrado en este tablero.');
    }

    await this.taskModel
      .updateMany(
        { boardId: boardObjectId, sprintId: sprintObjectId },
        { $set: { sprintId: null } },
      )
      .exec();
  }

  async assertSprintBelongsToBoard(
    sprintId: string,
    boardId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(sprintId)) {
      throw new ForbiddenException('Sprint no válido.');
    }
    const matchingCount = await this.sprintModel
      .countDocuments({
        _id: new Types.ObjectId(sprintId),
        boardId: new Types.ObjectId(boardId),
      })
      .exec();
    if (matchingCount === 0) {
      throw new NotFoundException(
        'El sprint no existe o no pertenece a este tablero.',
      );
    }
  }

  async deleteAllForBoard(boardId: string): Promise<void> {
    await this.sprintModel
      .deleteMany({ boardId: new Types.ObjectId(boardId) })
      .exec();
  }
}
