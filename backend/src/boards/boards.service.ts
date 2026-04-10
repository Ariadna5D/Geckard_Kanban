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
  BoardDocument,
  BoardMember,
  BoardRole,
} from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import slugify from 'slugify';
import { MongoServerError } from 'mongodb';
import { CreateColumnDto } from './dto/create-column.dto';
import { InviteBoardMemberDto } from './dto/invite-board-member.dto';
import { UsersService } from '../users/users.service';

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

// SERVICIO //////////////////////////////////////
@Injectable()
export class BoardsService {
  // INYECCIÓN DE MODELOS DE MONGOOSE Y OTROS SERVICIOS
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
  ) {}

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
    const t = task as {
      _id: Types.ObjectId;
      boardId: Types.ObjectId;
      columnId: Types.ObjectId;
      assigneeIds?: Types.ObjectId[];
      storyPointVotes?: { userId: Types.ObjectId; value: number }[];
      [key: string]: unknown;
    };
    const votes = t.storyPointVotes ?? [];
    const assigneeIds: string[] = [];
    const rawAssignees = t.assigneeIds ?? [];
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
      _id: t._id.toString(),
      boardId: t.boardId.toString(),
      columnId: t.columnId.toString(),
      assigneeIds,
      storyPointVotes: storyPointVotesOut,
      links: this.normalizeTaskLinksForClient(t.links),
      checklist: this.normalizeTaskChecklistForClient(t.checklist),
    };
    delete mapped.sprintId;
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
      .find({ boardId: boardDoc._id })
      .lean()
      .exec();

    type ColumnWithId = BoardColumn & { _id: Types.ObjectId };

    const columnsOut: unknown[] = [];
    const rawColumns = boardDoc.columns;
    for (let columnIndex = 0; columnIndex < rawColumns.length; columnIndex++) {
      const column = rawColumns[columnIndex];
      const columnWithId = column as ColumnWithId;
      const columnIdString = columnWithId._id.toString();
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
        tasks: mappedTasks,
      });
    }

    return {
      ...boardDoc,
      columns: columnsOut,
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
    const board = await this.boardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(boardId) },
        {
          $push: {
            columns: {
              _id: new Types.ObjectId(),
              title: createColumnDto.title,
              order: createColumnDto.order,
              tasks: [],
            },
          },
        },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    return board;
  }

  /**
   * Cambia solo el título de una columna.
   */
  async updateColumn(
    boardId: string,
    columnId: string,
    title: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const board = await this.boardModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(boardId),
          'columns._id': new Types.ObjectId(columnId),
        },
        { $set: { 'columns.$.title': title } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException(
        'La columna no existe o no pertenece a este tablero.',
      );
    }
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
    return board;
  }

  /**
   * Quita la columna y borra en cascada las tareas que había dentro.
   */
  async removeColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    await this.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    const board = await this.boardModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(boardId) },
        { $pull: { columns: { _id: new Types.ObjectId(columnId) } } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    await this.taskModel
      .deleteMany({ columnId: new Types.ObjectId(columnId) })
      .exec();

    return board;
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
      board.members.push({
        user: new Types.ObjectId(dto.userId),
        role: dto.role,
      });
    }

    return board.save();
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
  }
}
