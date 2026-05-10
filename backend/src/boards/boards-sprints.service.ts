import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardColumnKind,
  BoardDocument,
  BoardRole,
  SprintClosedTaskLabel,
  SprintClosedTaskSnapshot,
} from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateActiveSprintDto } from './dto/update-active-sprint.dto';
import { UpdateClosedSprintDto } from './dto/update-closed-sprint.dto';
import { BoardActivityService } from './board-activity.service';
import { UsersService } from '../users/users.service';
import { BoardsPermissionsService } from './boards-permissions.service';

const FREE_PLAN_MAX_CLOSED_SPRINTS = 4;
const PRO_PLAN_MAX_CLOSED_SPRINTS = 10;

@Injectable()
export class BoardsSprintsService {
  /**
   * Inyecta modelos y servicios para operaciones de sprint
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
    private readonly boardActivityService: BoardActivityService,
    private readonly permissionsService: BoardsPermissionsService,
  ) {}

  /**
   * Resuelve email del actor para guardar actividad
   */
  private async resolveActorEmail(userId: string): Promise<string> {
    try {
      const user = await this.usersService.findById(userId);
      let email = '';
      if (user && typeof user.email === 'string') {
        email = user.email.trim();
      }
      if (email.length > 0) {
        return email;
      }
      return '(sin-email)';
    } catch {
      return '(sin-email)';
    }
  }

  /**
   * Crea sprint activo cuando tablero y permisos lo permiten
   */
  async createSprint(
    boardId: string,
    createSprintDto: CreateSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Validamos permiso editor para operar con sprints
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    if (!board.sprintsEnabled) {
      throw new BadRequestException('Los sprints estan desactivados.');
    }

    // Solo se permite un sprint activo al mismo tiempo
    const hasActiveSprintAlready =
      board.activeSprintId !== undefined &&
      board.activeSprintId !== null &&
      String(board.activeSprintId).length > 0;
    if (hasActiveSprintAlready || board.sprints.length > 0) {
      throw new BadRequestException('Ya hay un sprint activo en este tablero.');
    }

    const trimmedSprintName = createSprintDto.name.trim();
    const newSprintId = new Types.ObjectId();

    let startedAt = new Date();
    if (createSprintDto.startedAt !== undefined) {
      const parsedStart = new Date(createSprintDto.startedAt);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new BadRequestException('La fecha de inicio no es válida.');
      }
      startedAt = parsedStart;
    }

    let plannedEndAt: Date | undefined;
    if (createSprintDto.plannedEndAt !== undefined) {
      const parsedEnd = new Date(createSprintDto.plannedEndAt);
      if (Number.isNaN(parsedEnd.getTime())) {
        throw new BadRequestException('La fecha no es valida.');
      }
      plannedEndAt = parsedEnd;
      if (plannedEndAt.getTime() < startedAt.getTime()) {
        throw new BadRequestException(
          'La fecha de fin debe ser mayor a la fecha de inicio.',
        );
      }
    }

    // Se arma subdocumento con fechas y objetivo opcional
    const sprintSubdocument: Record<string, unknown> = {
      _id: newSprintId,
      name: trimmedSprintName,
      startedAt,
    };
    if (plannedEndAt !== undefined) {
      sprintSubdocument['plannedEndAt'] = plannedEndAt;
    }
    if (createSprintDto.objective !== undefined) {
      const trimmedObjective = createSprintDto.objective.trim();
      if (trimmedObjective.length > 0) {
        sprintSubdocument['objective'] = trimmedObjective;
      }
    }

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $push: {
            sprints: sprintSubdocument,
          },
          $set: { activeSprintId: newSprintId },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }
    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.created',
      message: `Inició el sprint «${trimmedSprintName}».`,
      entityId: newSprintId.toString(),
    });
    return updatedBoard;
  }

  /**
   * Cierra sprint activo y guarda snapshot de tareas
   */
  async closeSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);

    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    if (!board.sprintsEnabled) {
      throw new BadRequestException(
        'Los sprints están desactivados en este tablero.',
      );
    }

    // El sprint enviado debe ser exactamente el sprint activo
    const activeIdString =
      board.activeSprintId !== undefined && board.activeSprintId !== null
        ? board.activeSprintId.toString()
        : '';
    if (!activeIdString || activeIdString !== sprintId) {
      throw new BadRequestException('Ese sprint no es el sprint activo.');
    }

    let activeSprintName = '';
    let sprintStartedAt: Date | undefined;
    let sprintPlannedEndAt: Date | undefined;
    let sprintObjective: string | undefined;
    let foundSprint = false;
    for (let index = 0; index < board.sprints.length; index++) {
      const sprintRow = board.sprints[index];
      if (sprintRow._id.toString() === sprintId) {
        activeSprintName = sprintRow.name;
        sprintStartedAt = sprintRow.startedAt;
        sprintPlannedEndAt = sprintRow.plannedEndAt;
        const rawObjective = sprintRow.objective;
        if (
          typeof rawObjective === 'string' &&
          rawObjective.trim().length > 0
        ) {
          sprintObjective = rawObjective.trim();
        } else {
          sprintObjective = undefined;
        }
        foundSprint = true;
        break;
      }
    }
    if (!foundSprint) {
      throw new BadRequestException(
        'No se encontró el sprint activo en el tablero.',
      );
    }

    // Revisa limite de sprints cerrados segun plan del owner
    const ownerUser = await this.usersService.findById(board.owner.toString());
    const ownerPlan = ownerUser?.userPlan ?? 'free';
    let closedSprintLimit: number | null = FREE_PLAN_MAX_CLOSED_SPRINTS;
    if (ownerPlan === 'pro') {
      closedSprintLimit = PRO_PLAN_MAX_CLOSED_SPRINTS;
    }
    if (ownerPlan === 'team') {
      closedSprintLimit = null;
    }

    // Corta si el plan ya alcanzo el limite de sprints cerrados
    const currentClosedSprintCount = board.closedSprintRecords.length;
    if (
      closedSprintLimit !== null &&
      currentClosedSprintCount >= closedSprintLimit
    ) {
      throw new ForbiddenException('Limite de sprints cerrados alcanzado.');
    }

    // Armamos mapas para saber columna y estado al momento del cierre
    const columnKindByColumnId = new Map<string, BoardColumnKind>();
    const columnTitleByColumnId = new Map<string, string>();
    for (
      let columnIndex = 0;
      columnIndex < board.columns.length;
      columnIndex++
    ) {
      const column = board.columns[columnIndex];
      const columnIdString = column._id.toString();
      columnTitleByColumnId.set(columnIdString, column.title);
      const rawKind = column.columnKind as BoardColumnKind | undefined;
      if (rawKind === 'done' || rawKind === 'archived') {
        columnKindByColumnId.set(columnIdString, rawKind);
      } else {
        columnKindByColumnId.set(columnIdString, 'workflow');
      }
    }

    const tasksInSprint = await this.taskModel
      .find({
        boardId: boardObjectId,
        sprintId: sprintObjectId,
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      })
      .lean()
      .exec();

    const taskSnapshots: SprintClosedTaskSnapshot[] = [];
    for (let taskIndex = 0; taskIndex < tasksInSprint.length; taskIndex++) {
      const taskRow = tasksInSprint[taskIndex];
      const columnIdString = taskRow.columnId.toString();
      const columnTitle =
        columnTitleByColumnId.get(columnIdString) ?? '(unknown column)';
      const columnKind = columnKindByColumnId.get(columnIdString) ?? 'workflow';
      const wasCompleted = columnKind === 'done' || columnKind === 'archived';

      const rawLabels = Array.isArray(
        (taskRow as { labels?: { name?: string; color?: string }[] }).labels,
      )
        ? (taskRow as { labels: { name?: string; color?: string }[] }).labels
        : [];
      const labelsAtClose: SprintClosedTaskLabel[] = [];
      for (let labelIndex = 0; labelIndex < rawLabels.length; labelIndex++) {
        const label = rawLabels[labelIndex];
        const nameRaw =
          typeof label?.name === 'string' ? label.name.trim().slice(0, 24) : '';
        if (!nameRaw) continue;
        const labelColorRaw =
          typeof label?.color === 'string' ? label.color : '';
        let normalizedLabelColor: SprintClosedTaskLabel['color'] = 'blue';
        if (labelColorRaw === 'green') {
          normalizedLabelColor = 'green';
        } else if (labelColorRaw === 'yellow') {
          normalizedLabelColor = 'yellow';
        } else if (labelColorRaw === 'orange') {
          normalizedLabelColor = 'orange';
        } else if (labelColorRaw === 'red') {
          normalizedLabelColor = 'red';
        } else if (labelColorRaw === 'purple') {
          normalizedLabelColor = 'purple';
        } else if (labelColorRaw === 'blue') {
          normalizedLabelColor = 'blue';
        } else if (labelColorRaw === 'sky') {
          normalizedLabelColor = 'sky';
        } else if (labelColorRaw === 'gray') {
          normalizedLabelColor = 'gray';
        }
        labelsAtClose.push({
          name: nameRaw,
          color: normalizedLabelColor,
        });
      }

      // Guarda una foto de la tarea tal como quedo al cerrar
      const snapshot: SprintClosedTaskSnapshot = {
        taskId: taskRow._id,
        title: taskRow.title,
        columnId: taskRow.columnId,
        columnTitleAtClose: columnTitle,
        wasCompleted,
        assigneeIdsAtClose: Array.isArray(taskRow.assigneeIds)
          ? taskRow.assigneeIds
          : [],
        labelsAtClose,
      };
      if (wasCompleted && typeof taskRow.storyPoints === 'number') {
        snapshot.storyPointsWhenDone = taskRow.storyPoints;
      }
      const updatedAtRaw = (taskRow as { updatedAt?: Date }).updatedAt;
      if (
        updatedAtRaw instanceof Date &&
        !Number.isNaN(updatedAtRaw.getTime())
      ) {
        snapshot.taskUpdatedAtAtClose = updatedAtRaw;
      }
      taskSnapshots.push(snapshot);
    }

    const closedRecord: Record<string, unknown> = {
      sprintId: sprintObjectId,
      sprintName: activeSprintName,
      closedAt: new Date(),
      taskSnapshots,
    };
    if (sprintStartedAt !== undefined) {
      closedRecord['startedAt'] = sprintStartedAt;
    }
    if (sprintPlannedEndAt !== undefined) {
      closedRecord['plannedEndAt'] = sprintPlannedEndAt;
    }
    if (sprintObjective !== undefined) {
      closedRecord['objective'] = sprintObjective;
    }

    // Se mueve sprint de activo a historial en un solo update
    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $pull: { sprints: { _id: sprintObjectId } },
          $push: { closedSprintRecords: closedRecord },
          $unset: { activeSprintId: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }

    await this.taskModel
      .updateMany(
        { boardId: boardObjectId, sprintId: sprintObjectId },
        { $unset: { sprintId: '' } },
      )
      .exec();

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.closed',
      message: `Cerró el sprint «${activeSprintName}».`,
      entityId: sprintId,
    });

    return updatedBoard;
  }

  /**
   * Edita nombre o fechas del sprint activo actual
   */
  async updateActiveSprint(
    boardId: string,
    sprintId: string,
    dto: UpdateActiveSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    if (
      dto.name === undefined &&
      dto.startedAt === undefined &&
      dto.plannedEndAt === undefined &&
      dto.objective === undefined
    ) {
      throw new BadRequestException('No hay cambios que guardar.');
    }

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);

    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const activeIdString =
      board.activeSprintId !== undefined && board.activeSprintId !== null
        ? board.activeSprintId.toString()
        : '';
    if (!activeIdString || activeIdString !== sprintId) {
      throw new BadRequestException('Solo puedes editar el sprint activo.');
    }

    let sprintRow: (typeof board.sprints)[number] | null = null;
    for (let index = 0; index < board.sprints.length; index++) {
      if (board.sprints[index]._id.toString() === sprintId) {
        sprintRow = board.sprints[index];
        break;
      }
    }
    if (sprintRow === null) {
      throw new BadRequestException('No se encontró el sprint en el tablero.');
    }

    // Solo aplicamos cambios sobre campos enviados en el dto
    const fieldsToSet: Record<string, unknown> = {};
    const fieldsToUnset: Record<string, ''> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException(
          'El nombre del sprint no puede estar vacío.',
        );
      }
      fieldsToSet['sprints.$.name'] = trimmedName;
    }

    let effectiveStartedAt = sprintRow.startedAt;
    if (dto.startedAt !== undefined) {
      const parsedStart = new Date(dto.startedAt);
      if (Number.isNaN(parsedStart.getTime())) {
        throw new BadRequestException('La fecha de inicio no es válida.');
      }
      fieldsToSet['sprints.$.startedAt'] = parsedStart;
      effectiveStartedAt = parsedStart;
    }

    let effectivePlannedEnd = sprintRow.plannedEndAt;
    if (dto.plannedEndAt !== undefined) {
      const parsedEnd = new Date(dto.plannedEndAt);
      if (Number.isNaN(parsedEnd.getTime())) {
        throw new BadRequestException('La fecha no es valida.');
      }
      fieldsToSet['sprints.$.plannedEndAt'] = parsedEnd;
      effectivePlannedEnd = parsedEnd;
    }

    if (
      effectivePlannedEnd !== undefined &&
      effectivePlannedEnd !== null &&
      effectivePlannedEnd.getTime() < effectiveStartedAt.getTime()
    ) {
      throw new BadRequestException(
        'La fecha de fin debe ser mayor a la fecha de inicio.',
      );
    }

    if (dto.objective !== undefined) {
      const trimmedObjective = dto.objective.trim();
      if (trimmedObjective.length > 0) {
        fieldsToSet['sprints.$.objective'] = trimmedObjective;
      } else {
        fieldsToUnset['sprints.$.objective'] = '';
      }
    }

    const updateOps: Record<string, unknown> = {};
    if (Object.keys(fieldsToSet).length > 0) {
      updateOps['$set'] = fieldsToSet;
    }
    if (Object.keys(fieldsToUnset).length > 0) {
      updateOps['$unset'] = fieldsToUnset;
    }

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId, 'sprints._id': sprintObjectId },
        updateOps,
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }
    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.updated',
      message: `Actualizó el sprint activo «${sprintRow.name}».`,
      entityId: sprintId,
    });
    return updatedBoard;
  }

  /**
   * Cancela sprint activo sin guardar en historial
   */
  async cancelActiveSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);

    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const activeIdString =
      board.activeSprintId !== undefined && board.activeSprintId !== null
        ? board.activeSprintId.toString()
        : '';
    if (!activeIdString || activeIdString !== sprintId) {
      throw new BadRequestException('Solo puedes cancelar el sprint activo.');
    }

    // Limpia sprintId de tareas y quita sprint activo del tablero
    await this.taskModel
      .updateMany(
        { boardId: boardObjectId, sprintId: sprintObjectId },
        { $unset: { sprintId: '' } },
      )
      .exec();

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $pull: { sprints: { _id: sprintObjectId } },
          $unset: { activeSprintId: '' },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }
    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.cancelled',
      message: 'Canceló el sprint activo sin guardar historial.',
      entityId: sprintId,
    });
    return updatedBoard;
  }

  /**
   * Renombra un sprint cerrado dentro del historial
   */
  async updateClosedSprintRecord(
    boardId: string,
    sprintId: string,
    dto: UpdateClosedSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);
    const trimmedName = dto.sprintName.trim();

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $set: {
            'closedSprintRecords.$[record].sprintName': trimmedName,
          },
        },
        {
          arrayFilters: [{ 'record.sprintId': sprintObjectId }],
          returnDocument: 'after',
        },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }

    // Se valida que el sprint exista en historial antes de responder
    let foundClosed = false;
    const closedList = updatedBoard.closedSprintRecords ?? [];
    for (let index = 0; index < closedList.length; index++) {
      if (closedList[index].sprintId.toString() === sprintId) {
        foundClosed = true;
        break;
      }
    }
    if (!foundClosed) {
      throw new NotFoundException('No se encontró ese sprint en el historial.');
    }

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.history.renamed',
      message: `Renombró un sprint cerrado a «${trimmedName}».`,
      entityId: sprintId,
    });

    return updatedBoard;
  }

  /**
   * Elimina un sprint cerrado del historial del tablero
   */
  async deleteClosedSprintRecord(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Este borrado es definitivo para el historial cerrdao
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const boardObjectId = new Types.ObjectId(boardId);
    const sprintObjectId = new Types.ObjectId(sprintId);

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $pull: {
            closedSprintRecords: { sprintId: sprintObjectId },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }
    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'sprint',
      action: 'sprint.history.deleted',
      message: 'Eliminó un sprint del historial.',
      entityId: sprintId,
    });
    return updatedBoard;
  }
}
