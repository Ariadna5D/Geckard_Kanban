import {
  Injectable,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import {
  Board,
  BoardColumn,
  BoardColumnKind,
  BoardDocument,
  BoardMember,
  BoardRole,
  SprintClosedTaskLabel,
  SprintClosedTaskSnapshot,
} from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import slugify from 'slugify';
import { MongoServerError } from 'mongodb';
import { CreateColumnDto } from './dto/create-column.dto';
import { InviteBoardMemberDto } from './dto/invite-board-member.dto';
import { UpdateColumnBodyDto } from './dto/update-column-body.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateActiveSprintDto } from './dto/update-active-sprint.dto';
import { UpdateClosedSprintDto } from './dto/update-closed-sprint.dto';
import { UsersService } from '../users/users.service';
import { BoardActivityService } from './board-activity.service';

/// Convierte un valor desconocido en un array, o devuelve null si no es un array. PARA LINTER
function asUnknownArray(raw: unknown): unknown[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  return raw as unknown[];
}

// Convierte un valor desconocido en un objeto con claves de texto, o devuelve null si no es un objeto así. PARA LINTER
function asStringKeyedObject(entry: unknown): Record<string, unknown> | null {
  if (entry === null || typeof entry !== 'object') {
    return null;
  }
  if (Array.isArray(entry)) {
    return null;
  }
  return entry as Record<string, unknown>;
}

/**
 * Array de subdocumentos de columna: en runtime Mongoose expone `.id(ObjectId)`.
 * La clase `Board` tipa `columns` como `BoardColumn[]`, sin ese método en TS.
 */
function boardColumnSubdocById(
  board: BoardDocument,
  columnId: Types.ObjectId,
): BoardColumn | null | undefined {
  const columnsWithId = board.columns as unknown as {
    id: (id: Types.ObjectId) => BoardColumn | null | undefined;
  };
  return columnsWithId.id(columnId);
}

/**
 * Título típico de columna "hecho": por defecto `columnKind: done` al crear (se puede cambiar en el menú).
 */
function inferColumnKindFromTitleForCreate(title: string): BoardColumnKind {
  const key = title.trim().toLowerCase();
  if (key === 'done' || key === 'hecho') {
    return 'done';
  }
  return 'workflow';
}

/** Máximo de filas en `members` (no cuenta al owner) con plan Free. */
const FREE_PLAN_MAX_BOARD_MEMBERS = 10;

// SERVICIO //////////////////////////////////////
@Injectable()
export class BoardsService {
  // INYECCIÓN DE MODELOS DE MONGOOSE Y OTROS SERVICIOS
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
    private readonly boardActivityService: BoardActivityService,
  ) {}

  private async resolveActorEmail(userId: string): Promise<string> {
    try {
      const user = await this.usersService.findById(userId);
      const email =
        user && typeof user.email === 'string' ? user.email.trim() : '';
      return email.length > 0 ? email : '(sin-email)';
    } catch {
      return '(sin-email)';
    }
  }

  // Rango de roles para comparar quién tiene más permisos (owner > admin > editor > viewer).
  private boardRoleRank(r: BoardRole): number {
    switch (r) {
      case BoardRole.VIEWER:
        return 1;
      case BoardRole.EDITOR:
        return 2;
      case BoardRole.ADMIN:
        return 3;
      case BoardRole.OWNER:
        return 4;
      default:
        return 0;
    }
  }

  // Comprueba si un tablero existe
  async boardExists(boardId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(boardId)) {
      return false;
    }
    const matchingCount = await this.boardModel
      .countDocuments({ _id: new Types.ObjectId(boardId) })
      .exec();
    return matchingCount > 0;
  }

  /** Columna existe y no está archivada (no se puede editar ni reordenar en el tablero). */
  private async assertColumnEditable(
    boardId: string,
    columnId: string,
  ): Promise<void> {
    const board = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    const sub = boardColumnSubdocById(board, new Types.ObjectId(columnId));
    if (!sub) {
      throw new NotFoundException('La columna no existe.');
    }
    const archivedAt = (sub as { archivedAt?: Date }).archivedAt;
    if (archivedAt != null) {
      throw new BadRequestException(
        'Esta columna está archivada. Restáurala desde los ajustes del tablero para poder editarla.',
      );
    }
  }

  // Dado el slug de un tablero, devuelve su id o null si no existe. PARA RUTAS CON SLUG
  async getBoardIdBySlug(slug: string): Promise<string | null> {
    const leanBoard = await this.boardModel
      .findOne({ slug })
      .select('_id')
      .lean()
      .exec();
    if (!leanBoard || !leanBoard._id) {
      return null;
    }
    return leanBoard._id.toString();
  }

  // Devuelve el rol efectivo de un usuario en un tablero.
  async getEffectiveBoardRole(
    boardId: string,
    userId: string,
  ): Promise<BoardRole | null> {
    if (!Types.ObjectId.isValid(boardId)) return null;
    const board = await this.boardModel
      .findById(boardId)
      .select('owner members')
      .lean()
      .exec();
    if (!board) return null;
    const ownerId = board.owner.toString();
    if (ownerId === userId) {
      return BoardRole.OWNER;
    }
    const memberEntries = board.members;
    for (let index = 0; index < memberEntries.length; index++) {
      const memberEntry = memberEntries[index];
      if (memberEntry.user.toString() === userId) {
        return memberEntry.role;
      }
    }
    return null;
  }

  // Comprueba que el usuario tenga al menos el rol mínimo requerido en el tablero
  async assertMinBoardRole(
    boardId: string,
    userId: string,
    minimum: BoardRole,
    isAppAdmin = false,
  ): Promise<void> {
    if (isAppAdmin) return;
    const role = await this.getEffectiveBoardRole(boardId, userId);
    if (!role || this.boardRoleRank(role) < this.boardRoleRank(minimum)) {
      throw new ForbiddenException(
        'No tienes permiso suficiente en este tablero.',
      );
    }
  }

  // Filtro de acceso a tablero: para consultas que necesitan cargar el tablero, asegura que el usuario tenga acceso
  private boardAccessFilter(
    boardId: string,
    userId: string,
    isAppAdmin: boolean,
  ): QueryFilter<BoardDocument> {
    const boardObjectId = new Types.ObjectId(boardId);
    if (isAppAdmin) {
      return { _id: boardObjectId };
    }
    const requestingUserObjectId = new Types.ObjectId(userId);
    return {
      _id: boardObjectId,
      $or: [
        { owner: requestingUserObjectId },
        { 'members.user': requestingUserObjectId },
      ],
    };
  }

  // Evita que alguien acceda a un tablero que no existe o al que no tiene acceso
  async assertUserHasBoardAccess(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    const filter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const matchingCount = await this.boardModel.countDocuments(filter).exec();
    if (matchingCount === 0) {
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
    }
  }

  // Evita que alguien acceda a una columna que no existe o que no pertenece al tablero
  async assertColumnBelongsToBoard(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    const columnBelongsFilter: QueryFilter<BoardDocument> = {
      ...this.boardAccessFilter(boardId, userId, isAppAdmin),
      'columns._id': new Types.ObjectId(columnId),
    };
    const matchingCount = await this.boardModel
      .countDocuments(columnBelongsFilter)
      .exec();
    if (matchingCount === 0) {
      throw new NotFoundException(
        'La columna no existe o no tienes permiso en este tablero.',
      );
    }
  }

  async getColumnTitle(boardId: string, columnId: string): Promise<string | null> {
    const board = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .select('columns._id columns.title')
      .lean()
      .exec();
    if (!board) return null;
    const rows = Array.isArray(board.columns)
      ? (board.columns as { _id: Types.ObjectId; title?: string }[])
      : [];
    for (let index = 0; index < rows.length; index++) {
      if (rows[index]._id.toString() === columnId) {
        const rawTitle = rows[index].title;
        return typeof rawTitle === 'string' && rawTitle.trim() !== ''
          ? rawTitle.trim()
          : null;
      }
    }
    return null;
  }

  /**
   * Validates sprint assignment on a task: disabled boards reject non-null ids;
   * when enabled, only the active sprint id is accepted (null always clears the tag).
   */
  async assertTaskSprintAssignmentAllowed(
    boardId: string,
    sprintId: string | null | undefined,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    if (sprintId === undefined) {
      return;
    }
    if (typeof sprintId === 'string' && sprintId.trim() === '') {
      throw new BadRequestException('El sprintId no es válido.');
    }

    await this.assertUserHasBoardAccess(boardId, userId, isAppAdmin);

    const boardFilter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const boardLean = await this.boardModel.findOne(boardFilter).lean().exec();
    if (!boardLean) {
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
    }

    const sprintsAreEnabled = boardLean.sprintsEnabled === true;

    if (sprintId === null) {
      return;
    }

    if (!sprintsAreEnabled) {
      throw new BadRequestException(
        'Los sprints están desactivados en este tablero.',
      );
    }

    const activeSprintIdString =
      boardLean.activeSprintId !== undefined && boardLean.activeSprintId !== null
        ? boardLean.activeSprintId.toString()
        : '';

    if (!activeSprintIdString || activeSprintIdString !== sprintId) {
      throw new BadRequestException(
        'Solo puedes asignar la tarea al sprint activo del tablero.',
      );
    }
  }

  // Crea un nuevo tablero con un título único y slug generado automáticamente
  async create(
    createBoardDto: CreateBoardDto,
    userId: string,
  ): Promise<BoardDocument> {
    const baseSlug = slugify(createBoardDto.title, {
      lower: true,
      strict: true,
    });
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const uniqueSlug = `${baseSlug}-${randomSuffix}`;

    try {
      return await this.boardModel.create({
        ...createBoardDto,
        slug: uniqueSlug,
        owner: new Types.ObjectId(userId),
        members: [{ user: new Types.ObjectId(userId), role: BoardRole.OWNER }],
      });
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictException(
          'Hubo un problema al generar la URL del tablero.',
        );
      }
      throw new InternalServerErrorException(
        'Error fatal al crear el tablero.',
      );
    }
  }

  // Devuelve la lista de tableros a los que el usuario tiene acceso, ordenados por fecha de actualización
  async findAll(userId: string): Promise<BoardDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    return this.boardModel
      .find({
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  // Carga un tablero por su URL amigable y mete las tareas dentro de cada columna. PARA RUTAS CON SLUG
  private normalizeTaskLinksForClient(
    raw: unknown,
  ): { url: string; title?: string }[] {
    const items = asUnknownArray(raw);
    if (items === null) {
      return [];
    }
    const normalizedLinks: { url: string; title?: string }[] = [];
    for (let index = 0; index < items.length; index++) {
      const record = asStringKeyedObject(items[index]);
      if (record === null) {
        continue;
      }
      const urlVal = record['url'];
      if (typeof urlVal !== 'string') {
        continue;
      }
      const url = urlVal.trim();
      if (!url) {
        continue;
      }
      const titleVal = record['title'];
      const titleTrim =
        typeof titleVal === 'string' ? titleVal.trim().slice(0, 200) : '';
      if (titleTrim) {
        normalizedLinks.push({ url, title: titleTrim });
      } else {
        normalizedLinks.push({ url });
      }
    }
    return normalizedLinks;
  }

  // Normaliza el checklist de una tarea para que el front reciba JSON sencillo
  private normalizeTaskChecklistForClient(
    raw: unknown,
  ): { text: string; checked: boolean }[] {
    const items = asUnknownArray(raw);
    if (items === null) {
      return [];
    }
    const normalizedChecklist: { text: string; checked: boolean }[] = [];
    for (let index = 0; index < items.length; index++) {
      const record = asStringKeyedObject(items[index]);
      if (record === null) {
        continue;
      }
      const textVal = record['text'];
      if (typeof textVal !== 'string') {
        continue;
      }
      const text = textVal.trim().slice(0, 500);
      if (!text) {
        continue;
      }
      const checkedVal = record['checked'];
      normalizedChecklist.push({ text, checked: checkedVal === true });
    }
    return normalizedChecklist;
  }

  // Devuelve un tablero con sus columnas y tareas, asegurando que el usuario tenga acceso. PARA RUTAS CON SLUG
  private mapTaskForBoardClient(task: Record<string, unknown>) {
    const typedTask = task as {
      _id: Types.ObjectId;
      boardId: Types.ObjectId;
      columnId: Types.ObjectId;
      sprintId?: Types.ObjectId;
      assigneeIds?: Types.ObjectId[];
      storyPointVotes?: { userId: Types.ObjectId; value: number }[];
      [key: string]: unknown;
    };
    const votes = typedTask.storyPointVotes ?? [];
    const assigneeIds: string[] = [];
    const rawAssignees = typedTask.assigneeIds ?? [];
    for (let index = 0; index < rawAssignees.length; index++) {
      assigneeIds.push(rawAssignees[index].toString());
    }
    const storyPointVotesOut: { userId: string; value: number }[] = [];
    for (let index = 0; index < votes.length; index++) {
      const vote = votes[index];
      let voterUserId = '';
      if (vote.userId !== undefined && vote.userId !== null) {
        voterUserId = vote.userId.toString();
      }
      storyPointVotesOut.push({
        userId: voterUserId,
        value: vote.value,
      });
    }
    const mapped: Record<string, unknown> = {
      ...task,
      _id: typedTask._id.toString(),
      boardId: typedTask.boardId.toString(),
      columnId: typedTask.columnId.toString(),
      assigneeIds,
      storyPointVotes: storyPointVotesOut,
      links: this.normalizeTaskLinksForClient(typedTask.links),
      checklist: this.normalizeTaskChecklistForClient(typedTask.checklist),
    };
    if (typedTask.sprintId !== undefined && typedTask.sprintId !== null) {
      mapped['sprintId'] = typedTask.sprintId.toString();
    }
    return mapped;
  }

  // Devuelve un tablero con sus columnas y tareas, asegurando que el usuario tenga acceso. PARA RUTAS CON SLUG
  async findOneBySlug(slug: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const boardDoc = await this.boardModel
      .findOne({
        slug,
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .lean()
      .exec();

    if (!boardDoc)
      throw new NotFoundException(`El tablero no existe o no tienes permiso.`);

    const tasks = await this.taskModel
      .find({
        boardId: boardDoc._id,
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      })
      .lean()
      .exec();

    type ColumnWithId = BoardColumn & { _id: Types.ObjectId };

    const columnsOut: unknown[] = [];
    const archivedColumnsOut: unknown[] = [];
    const rawColumns = boardDoc.columns;
    for (let columnIndex = 0; columnIndex < rawColumns.length; columnIndex++) {
      const column = rawColumns[columnIndex];
      const columnWithId = column as ColumnWithId;
      const columnIdString = columnWithId._id.toString();
      const columnArchivedAt = (column as { archivedAt?: Date }).archivedAt;
      const columnArchivedBy = (column as { archivedBy?: Types.ObjectId })
        .archivedBy;
      const columnKindValue: BoardColumnKind =
        column.columnKind === 'done' || column.columnKind === 'archived'
          ? column.columnKind
          : 'workflow';
      if (columnArchivedAt != null) {
        archivedColumnsOut.push({
          _id: columnIdString,
          title: column.title,
          order: column.order,
          columnKind: columnKindValue,
          archivedAt:
            columnArchivedAt instanceof Date
              ? columnArchivedAt.toISOString()
              : String(columnArchivedAt),
          ...(columnArchivedBy
            ? { archivedBy: columnArchivedBy.toString() }
            : {}),
        });
        continue;
      }
      const columnTasksRaw: (typeof tasks)[number][] = [];
      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
        const taskRow = tasks[taskIndex];
        if (taskRow.columnId.toString() === columnIdString) {
          columnTasksRaw.push(taskRow);
        }
      }
      columnTasksRaw.sort((first, second) => {
        if (first.order === second.order) return 0;
        return first.order < second.order ? -1 : 1;
      });
      const mappedTasks: unknown[] = [];
      for (
        let mappedIndex = 0;
        mappedIndex < columnTasksRaw.length;
        mappedIndex++
      ) {
        mappedTasks.push(
          this.mapTaskForBoardClient(
            columnTasksRaw[mappedIndex] as unknown as Record<string, unknown>,
          ),
        );
      }
      columnsOut.push({
        ...column,
        columnKind: columnKindValue,
        tasks: mappedTasks,
      });
    }

    return {
      ...boardDoc,
      columns: columnsOut,
      archivedColumns: archivedColumnsOut,
    };
  }

  // Cambia el título o la descripción de un tablero
  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string,
    isAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(id, userId, BoardRole.ADMIN, isAdmin);

    const updatedBoard = await this.boardModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id) }, updateBoardDto, {
        new: true,
      })
      .exec();

    if (!updatedBoard)
      throw new NotFoundException('No se encontró el tablero.');

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId: id,
      actorUserId: userId,
      actorEmail,
      entityType: 'board',
      action: 'board.updated',
      message: `Actualizó la configuración del tablero «${updatedBoard.title}».`,
      entityId: id,
    });
    return updatedBoard;
  }

  /**
   * Borra tablero y todas sus tareas (solo quien tenga permiso fuerte).
   */
  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    await this.assertMinBoardRole(id, userId, BoardRole.OWNER, isAdmin);

    const board = await this.boardModel
      .findOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (!board) throw new NotFoundException('No se pudo eliminar el tablero.');

    await this.taskModel.deleteMany({ boardId: new Types.ObjectId(id) }).exec();
    await this.boardModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
  }

  // --- GESTIÓN DE COLUMNAS ---

  async addColumn(
    boardId: string,
    createColumnDto: CreateColumnDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const trimmedTitle = createColumnDto.title.trim();
    const initialColumnKind = inferColumnKindFromTitleForCreate(trimmedTitle);

    const board = await this.boardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(boardId) },
        {
          $push: {
            columns: {
              _id: new Types.ObjectId(),
              title: trimmedTitle,
              order: createColumnDto.order,
              tasks: [],
              columnKind: initialColumnKind,
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.created',
      message: `Creó la columna «${trimmedTitle}».`,
    });
    return board;
  }

  /**
   * Updates column title and/or column kind (workflow vs done vs archived).
   */
  async updateColumn(
    boardId: string,
    columnId: string,
    body: UpdateColumnBodyDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    await this.assertColumnEditable(boardId, columnId);

    if (body.title === undefined && body.columnKind === undefined) {
      throw new BadRequestException(
        'Debes enviar al menos title o columnKind para actualizar la columna.',
      );
    }

    const fieldsToSet: Record<string, string> = {};
    if (body.title !== undefined) {
      const trimmedTitle = body.title.trim();
      if (!trimmedTitle) {
        throw new BadRequestException('El título de la columna no puede estar vacío.');
      }
      fieldsToSet['columns.$.title'] = trimmedTitle;
    }
    if (body.columnKind !== undefined) {
      fieldsToSet['columns.$.columnKind'] = body.columnKind;
    }

    const board = await this.boardModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(boardId),
          'columns._id': new Types.ObjectId(columnId),
        },
        { $set: fieldsToSet },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException(
        'La columna no existe o no pertenece a este tablero.',
      );
    }
    const actorEmail = await this.resolveActorEmail(userId);
    const changeParts: string[] = [];
    if (body.title !== undefined) {
      changeParts.push(`nombre a «${body.title.trim()}»`);
    }
    if (body.columnKind !== undefined) {
      changeParts.push(`tipo a «${body.columnKind}»`);
    }
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.updated',
      message: `Actualizó la columna (${changeParts.join(', ')}).`,
      entityId: columnId,
    });
    return board;
  }

  /**
   * Guarda la posición al arrastrar columnas (el front manda un “order” nuevo).
   */
  async updateColumnPosition(
    boardId: string,
    columnId: string,
    order: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    await this.assertColumnEditable(boardId, columnId);
    const board = await this.boardModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(boardId),
          'columns._id': new Types.ObjectId(columnId),
        },
        { $set: { 'columns.$.order': order } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException(
        'La columna no existe o no pertenece a este tablero.',
      );
    }
    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.reordered',
      message: 'Reordenó una columna del tablero.',
      entityId: columnId,
    });
    return board;
  }

  /**
   * Archiva la columna (oculta del tablero) y archiva las tareas no archivadas de esa columna.
   */
  async archiveColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const boardObjectId = new Types.ObjectId(boardId);
    const colObjectId = new Types.ObjectId(columnId);
    const userObjectId = new Types.ObjectId(userId);
    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    const columnSub = boardColumnSubdocById(board, colObjectId);
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    if ((columnSub as { archivedAt?: Date }).archivedAt != null) {
      return this.findOneBySlug(board.slug, userId);
    }

    await this.boardModel
      .updateOne(
        { _id: boardObjectId, 'columns._id': colObjectId },
        {
          $set: {
            'columns.$.archivedAt': new Date(),
            'columns.$.archivedBy': userObjectId,
          },
        },
      )
      .exec();

    await this.taskModel
      .updateMany(
        {
          boardId: boardObjectId,
          columnId: colObjectId,
          $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
        },
        {
          $set: {
            archivedAt: new Date(),
            archivedBy: userObjectId,
            archivedWithColumnId: colObjectId,
          },
          $unset: { sprintId: '' },
        },
      )
      .exec();

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.archived',
      message: `Archivó la columna «${columnSub.title}».`,
      entityId: columnId,
    });

    return this.findOneBySlug(board.slug, userId);
  }

  /**
   * Restaura una columna archivada y las tareas que se archivaron junto con ella.
   */
  async restoreColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const boardObjectId = new Types.ObjectId(boardId);
    const colObjectId = new Types.ObjectId(columnId);
    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    const columnSub = boardColumnSubdocById(board, colObjectId);
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    if ((columnSub as { archivedAt?: Date }).archivedAt == null) {
      return this.findOneBySlug(board.slug, userId);
    }

    await this.boardModel
      .updateOne(
        { _id: boardObjectId, 'columns._id': colObjectId },
        { $unset: { 'columns.$.archivedAt': '', 'columns.$.archivedBy': '' } },
      )
      .exec();

    await this.taskModel
      .updateMany(
        {
          boardId: boardObjectId,
          columnId: colObjectId,
          archivedWithColumnId: colObjectId,
        },
        {
          $unset: {
            archivedAt: '',
            archivedBy: '',
            archivedWithColumnId: '',
          },
        },
      )
      .exec();

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.restored',
      message: `Restauró la columna «${columnSub.title}».`,
      entityId: columnId,
    });

    return this.findOneBySlug(board.slug, userId);
  }

  /**
   * Elimina definitivamente una columna **ya archivada** y todas las tareas con ese columnId.
   */
  async removeColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const boardObjectId = new Types.ObjectId(boardId);
    const colObjectId = new Types.ObjectId(columnId);
    const board = await this.boardModel.findById(boardObjectId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    const columnSub = boardColumnSubdocById(board, colObjectId);
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    if ((columnSub as { archivedAt?: Date }).archivedAt == null) {
      throw new BadRequestException(
        'Archiva la columna primero. Las columnas activas no se pueden borrar definitivamente.',
      );
    }

    await this.taskModel
      .deleteMany({ columnId: colObjectId })
      .exec();

    const updated = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        { $pull: { columns: { _id: colObjectId } } },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('El tablero no existe.');
    }

    const actorEmail = await this.resolveActorEmail(userId);
    await this.boardActivityService.record({
      boardId,
      actorUserId: userId,
      actorEmail,
      entityType: 'column',
      action: 'column.deleted',
      message: `Eliminó definitivamente la columna «${columnSub.title}».`,
      entityId: columnId,
    });

    return this.findOneBySlug(board.slug, userId);
  }

  /**
   * Starts a new sprint (board must have sprints enabled and no active sprint yet).
   */
  async createSprint(
    boardId: string,
    createSprintDto: CreateSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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
      throw new BadRequestException(
        'Activa los sprints en la configuración del tablero antes de crear uno.',
      );
    }

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
        throw new BadRequestException('La fecha de fin planificada no es válida.');
      }
      plannedEndAt = parsedEnd;
      if (plannedEndAt.getTime() < startedAt.getTime()) {
        throw new BadRequestException(
          'La fecha de fin debe ser posterior a la fecha de inicio.',
        );
      }
    }

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
        { new: true },
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
   * Closes the active sprint: saves a frozen snapshot and removes sprintId from tasks.
   */
  async closeSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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
      const row = board.sprints[index];
      if (row._id.toString() === sprintId) {
        activeSprintName = row.name;
        sprintStartedAt = row.startedAt;
        sprintPlannedEndAt = row.plannedEndAt;
        const rawObj = row.objective;
        sprintObjective =
          typeof rawObj === 'string' && rawObj.trim().length > 0
            ? rawObj.trim()
            : undefined;
        foundSprint = true;
        break;
      }
    }
    if (!foundSprint) {
      throw new BadRequestException('No se encontró el sprint activo en el tablero.');
    }

    const columnKindByColumnId = new Map<string, BoardColumnKind>();
    const columnTitleByColumnId = new Map<string, string>();
    for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
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

      const LABEL_COLORS = [
        'green',
        'yellow',
        'orange',
        'red',
        'purple',
        'blue',
        'sky',
        'gray',
      ] as const satisfies readonly SprintClosedTaskLabel['color'][];
      function parseSnapshotLabelColor(raw: string): SprintClosedTaskLabel['color'] {
        for (let ci = 0; ci < LABEL_COLORS.length; ci++) {
          if (LABEL_COLORS[ci] === raw) {
            return LABEL_COLORS[ci];
          }
        }
        return 'blue';
      }
      const rawLabels = Array.isArray(
        (taskRow as { labels?: { name?: string; color?: string }[] }).labels,
      )
        ? (taskRow as { labels: { name?: string; color?: string }[] }).labels
        : [];
      const labelsAtClose: SprintClosedTaskLabel[] = [];
      for (let li = 0; li < rawLabels.length; li++) {
        const lab = rawLabels[li];
        const nameRaw =
          typeof lab?.name === 'string' ? lab.name.trim().slice(0, 24) : '';
        if (!nameRaw) continue;
        const c = typeof lab?.color === 'string' ? lab.color : '';
        labelsAtClose.push({
          name: nameRaw,
          color: parseSnapshotLabelColor(c),
        });
      }

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
      if (updatedAtRaw instanceof Date && !Number.isNaN(updatedAtRaw.getTime())) {
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

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        {
          $pull: { sprints: { _id: sprintObjectId } },
          $push: { closedSprintRecords: closedRecord },
          $unset: { activeSprintId: '' },
        },
        { new: true },
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
   * Renames or changes planned dates on the active sprint (editors and up).
   */
  async updateActiveSprint(
    boardId: string,
    sprintId: string,
    dto: UpdateActiveSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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

    const fieldsToSet: Record<string, unknown> = {};
    const fieldsToUnset: Record<string, ''> = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('El nombre del sprint no puede estar vacío.');
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
        throw new BadRequestException('La fecha de fin planificada no es válida.');
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
        'La fecha de fin debe ser posterior a la fecha de inicio.',
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
        { new: true },
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
   * Drops the active sprint without saving history (tasks lose sprint tag).
   */
  async cancelActiveSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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
        { new: true },
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
   * Renames one closed sprint entry (board admins / app admin).
   */
  async updateClosedSprintRecord(
    boardId: string,
    sprintId: string,
    dto: UpdateClosedSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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
          new: true,
        },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }

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
   * Removes one closed sprint from history (board admins / app admin).
   */
  async deleteClosedSprintRecord(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
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
        { new: true },
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

  /**
   * Invita a alguien o le cambia el rol si ya estaba dentro.
   */
  async inviteMember(
    boardId: string,
    dto: InviteBoardMemberDto,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    const target = await this.usersService.findById(dto.userId);
    if (!target) {
      throw new NotFoundException('No existe ese usuario.');
    }

    await this.assertMinBoardRole(
      boardId,
      actorUserId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const board = await this.boardModel.findById(boardId).exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const ownerId = board.owner.toString();
    if (dto.userId === ownerId) {
      throw new BadRequestException(
        'El propietario ya tiene acceso al tablero.',
      );
    }

    let existingMemberIndex = -1;
    for (let index = 0; index < board.members.length; index++) {
      if (board.members[index].user.toString() === dto.userId) {
        existingMemberIndex = index;
        break;
      }
    }

    if (existingMemberIndex >= 0) {
      if (board.members[existingMemberIndex].role === BoardRole.OWNER) {
        throw new BadRequestException(
          'No se puede cambiar el rol del propietario desde aquí.',
        );
      }
      board.members[existingMemberIndex].role = dto.role;
    } else {
      await this.assertNewMemberAllowedByOwnerPlan(board);
      board.members.push({
        user: new Types.ObjectId(dto.userId),
        role: dto.role,
      });
    }
    const saved = await board.save();
    const actorEmail = await this.resolveActorEmail(actorUserId);
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: existingMemberIndex >= 0 ? 'member.role.updated' : 'member.invited',
      message:
        existingMemberIndex >= 0
          ? `Actualizó el rol de «${target.email}» a «${dto.role}».`
          : `Invitó a «${target.email}» como «${dto.role}».`,
      entityId: dto.userId,
    });
    return saved;
  }

  /**
   * Plan Free: como mucho 10 usuarios en `members` (el owner no cuenta).
   * Pro y Team: sin tope aquí.
   */
  private async assertNewMemberAllowedByOwnerPlan(
    board: BoardDocument,
  ): Promise<void> {
    const ownerUser = await this.usersService.findById(board.owner.toString());
    let ownerPlan = 'free';
    if (ownerUser !== null && ownerUser.userPlan !== undefined && ownerUser.userPlan !== null) {
      ownerPlan = ownerUser.userPlan;
    }
    if (ownerPlan === 'free' && board.members.length >= FREE_PLAN_MAX_BOARD_MEMBERS) {
      throw new ForbiddenException(
        'Con el plan Free solo puedes tener hasta 10 colaboradores en el tablero. Pasa a Pro para invitar sin límite.',
      );
    }
  }

  // Devuelve la lista de miembros de un tablero con su rol, asegurando que el usuario tenga acceso
  async listMembers(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<{
    ownerId: string;
    members: {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      role: BoardRole;
    }[];
  }> {
    await this.assertUserHasBoardAccess(boardId, userId, isAppAdmin);
    const board = await this.boardModel
      .findById(boardId)
      .populate({
        path: 'members.user',
        select: 'username email avatarUrl',
      })
      .lean()
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    const ownerId = board.owner.toString();
    type PopulatedMember = {
      user:
        | Types.ObjectId
        | {
            _id: Types.ObjectId;
            username?: string;
            email?: string;
            avatarUrl?: string;
          };
      role: BoardRole;
    };

    const rawRows: {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      role: BoardRole;
    }[] = [];

    const populatedMembers = board.members as unknown as PopulatedMember[];
    for (let index = 0; index < populatedMembers.length; index++) {
      const memberEntry = populatedMembers[index];
      const populatedUser = memberEntry.user;
      let memberUserIdString: string;
      let displayUsername: string;
      let displayEmail: string;
      let displayAvatarUrl: string | undefined;
      if (
        populatedUser &&
        typeof populatedUser === 'object' &&
        '_id' in populatedUser
      ) {
        const userDocument = populatedUser as {
          _id: Types.ObjectId;
          username?: string;
          email?: string;
          avatarUrl?: string;
        };
        memberUserIdString = userDocument._id.toString();
        displayUsername =
          userDocument.username !== undefined
            ? userDocument.username
            : 'Usuario';
        displayEmail =
          userDocument.email !== undefined ? userDocument.email : '';
        if (
          userDocument.avatarUrl !== undefined &&
          String(userDocument.avatarUrl).trim() !== ''
        ) {
          displayAvatarUrl = String(userDocument.avatarUrl);
        } else {
          displayAvatarUrl = undefined;
        }
      } else {
        memberUserIdString = (populatedUser as Types.ObjectId).toString();
        displayUsername = 'Usuario';
        displayEmail = '';
        displayAvatarUrl = undefined;
      }
      rawRows.push({
        userId: memberUserIdString,
        username: displayUsername,
        email: displayEmail,
        avatarUrl: displayAvatarUrl,
        role: memberEntry.role,
      });
    }

    type MemberRow = {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      role: BoardRole;
    };
    const membersByUserId: Record<string, MemberRow> = {};
    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const previousRow = membersByUserId[row.userId];
      if (
        !previousRow ||
        this.boardRoleRank(row.role) > this.boardRoleRank(previousRow.role)
      ) {
        membersByUserId[row.userId] = row;
      }
    }

    const dedupedMembers: MemberRow[] = [];
    const uniqueUserIds = Object.keys(membersByUserId);
    for (let index = 0; index < uniqueUserIds.length; index++) {
      const key = uniqueUserIds[index];
      dedupedMembers.push(membersByUserId[key]);
    }

    dedupedMembers.sort(function sortMemberRows(first, second) {
      if (first.userId === ownerId) {
        return -1;
      }
      if (second.userId === ownerId) {
        return 1;
      }
      return first.username.localeCompare(second.username, 'es', {
        sensitivity: 'base',
      });
    });

    const members = dedupedMembers;

    return { ownerId, members };
  }

  async listBoardActivity(
    boardId: string,
    userId: string,
    isAppAdmin = false,
    limit = 60,
  ) {
    await this.assertUserHasBoardAccess(boardId, userId, isAppAdmin);
    return this.boardActivityService.listByBoard(boardId, limit);
  }

  // Expulsa a un miembro del tablero
  async removeMember(
    boardId: string,
    memberUserId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.assertMinBoardRole(
      boardId,
      actorUserId,
      BoardRole.ADMIN,
      isAppAdmin,
    );

    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    if (board.owner.toString() === memberUserId) {
      throw new BadRequestException(
        'No puedes expulsar al propietario del tablero.',
      );
    }

    const memberCountBefore = board.members.length;
    const keptMembers: BoardMember[] = [];
    for (let index = 0; index < board.members.length; index++) {
      const member = board.members[index];
      if (member.user.toString() !== memberUserId) {
        keptMembers.push(member);
      }
    }
    board.members = keptMembers;
    if (board.members.length === memberCountBefore) {
      throw new NotFoundException('Ese usuario no es miembro del tablero.');
    }

    await board.save();
    const actorEmail = await this.resolveActorEmail(actorUserId);
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: 'member.removed',
      message: 'Expulsó a un miembro del tablero.',
      entityId: memberUserId,
    });
  }

  /**
   * Permite que un miembro abandone el tablero por sí mismo.
   * El propietario no puede salir sin transferir propiedad.
   */
  async leaveBoard(
    boardId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.assertUserHasBoardAccess(boardId, actorUserId, isAppAdmin);

    const board = await this.boardModel.findById(boardId).exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    if (board.owner.toString() === actorUserId) {
      throw new BadRequestException(
        'El propietario no puede abandonar su propio tablero.',
      );
    }

    const memberCountBefore = board.members.length;
    const keptMembers: BoardMember[] = [];
    for (let index = 0; index < board.members.length; index++) {
      const member = board.members[index];
      if (member.user.toString() !== actorUserId) {
        keptMembers.push(member);
      }
    }
    board.members = keptMembers;

    if (board.members.length === memberCountBefore) {
      throw new BadRequestException(
        'No eres miembro directo del tablero; no se puede abandonar.',
      );
    }

    await board.save();
    const actorEmail = await this.resolveActorEmail(actorUserId);
    await this.boardActivityService.record({
      boardId,
      actorUserId,
      actorEmail,
      entityType: 'member',
      action: 'member.left',
      message: 'Abandonó el tablero.',
      entityId: actorUserId,
    });
  }
}
