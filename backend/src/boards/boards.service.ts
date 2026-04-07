import {
  Injectable,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardColumn,
  BoardDocument,
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

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Número más alto = más permisos en el tablero (sirve para comparar roles).
   */
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

  /**
   * Comprueba si existe un tablero con ese id (sin cargar todo el documento).
   */
  async boardExists(boardId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(boardId)) return false;
    const n = await this.boardModel
      .countDocuments({ _id: new Types.ObjectId(boardId) })
      .exec();
    return n > 0;
  }

  /**
   * El “slug” es la parte bonita de la URL; aquí obtenemos el id real del tablero.
   */
  async getBoardIdBySlug(slug: string): Promise<string | null> {
    const b = await this.boardModel
      .findOne({ slug })
      .select('_id')
      .lean()
      .exec();
    return b?._id?.toString() ?? null;
  }

  /**
   * Dice qué rol tiene una persona: si es la dueña del tablero, o un miembro invitado, o nada.
   */
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
    if (ownerId === userId) return BoardRole.OWNER;
    for (const member of board.members) {
      if (member.user.toString() === userId) {
        return member.role;
      }
    }
    return null;
  }

  /**
   * Lanza error si el usuario no llega al rol mínimo pedido (por ejemplo solo lectura).
   */
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

  /**
   * Condiciones de Mongo para “este usuario puede ver este tablero”.
   */
  private boardAccessFilter(
    boardId: string,
    userId: string,
    isAppAdmin: boolean,
  ): object {
    const bid = new Types.ObjectId(boardId);
    if (isAppAdmin) return { _id: bid };
    const uid = new Types.ObjectId(userId);
    return {
      _id: bid,
      $or: [{ owner: uid }, { 'members.user': uid }],
    };
  }

  /**
   * Comprueba que el tablero exista y que el usuario sea dueño o esté invitado.
   */
  async assertUserHasBoardAccess(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    const filter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const n = await this.boardModel.countDocuments(filter as never).exec();
    if (n === 0) {
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
    }
  }

  /**
   * Evita que alguien cree tareas en columnas de otro tablero.
   */
  async assertColumnBelongsToBoard(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    const filter = {
      ...this.boardAccessFilter(boardId, userId, isAppAdmin),
      'columns._id': new Types.ObjectId(columnId),
    };
    const n = await this.boardModel.countDocuments(filter as never).exec();
    if (n === 0) {
      throw new NotFoundException(
        'La columna no existe o no tienes permiso en este tablero.',
      );
    }
  }

  /**
   * Crea tablero nuevo: el usuario queda como dueño y miembro.
   */
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

  /**
   * Tableros donde participo (creados por mí o donde me invitaron).
   */
  async findAll(userId: string): Promise<BoardDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    return this.boardModel
      .find({
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * Asegura enlaces y checklist como JSON plano (por si el driver devuelve subdocumentos raros).
   */
  private normalizeTaskLinksForClient(
    raw: unknown,
  ): { url: string; title?: string }[] {
    if (!Array.isArray(raw)) return [];
    const out: { url: string; title?: string }[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const urlVal = (entry as { url?: unknown }).url;
      if (typeof urlVal !== 'string') continue;
      const url = urlVal.trim();
      if (!url) continue;
      const titleVal = (entry as { title?: unknown }).title;
      const titleTrim =
        typeof titleVal === 'string' ? titleVal.trim().slice(0, 200) : '';
      if (titleTrim) out.push({ url, title: titleTrim });
      else out.push({ url });
    }
    return out;
  }

  private normalizeTaskChecklistForClient(
    raw: unknown,
  ): { text: string; checked: boolean }[] {
    if (!Array.isArray(raw)) return [];
    const out: { text: string; checked: boolean }[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const textVal = (entry as { text?: unknown }).text;
      if (typeof textVal !== 'string') continue;
      const text = textVal.trim().slice(0, 500);
      if (!text) continue;
      const checkedVal = (entry as { checked?: unknown }).checked;
      out.push({ text, checked: checkedVal === true });
    }
    return out;
  }

  /**
   * Pasa ids de Mongo a texto para que el front reciba JSON sencillo.
   */
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
    return {
      ...task,
      _id: t._id.toString(),
      boardId: t.boardId.toString(),
      columnId: t.columnId.toString(),
      assigneeIds: (t.assigneeIds ?? []).map((id) => id.toString()),
      storyPointVotes: votes.map((v) => ({
        userId: v.userId?.toString?.() ?? '',
        value: v.value,
      })),
      links: this.normalizeTaskLinksForClient(t.links),
      checklist: this.normalizeTaskChecklistForClient(t.checklist),
    };
  }

  /**
   * Carga un tablero por su URL amigable y mete las tareas dentro de cada columna.
   */
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

    return {
      ...boardDoc,
      columns: boardDoc.columns.map((column) => {
        const col = column as ColumnWithId;
        return {
          ...column,
          tasks: tasks
            .filter((task) => task.columnId.toString() === col._id.toString())
            .map((task) =>
              this.mapTaskForBoardClient(
                task as unknown as Record<string, unknown>,
              ),
            ),
        };
      }),
    };
  }

  /**
   * Cambia título u otros datos básicos del tablero (según permisos).
   */
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

  /**
   * Añade una columna nueva al final del tablero.
   */
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

    const idx = board.members.findIndex(
      (m) => m.user.toString() === dto.userId,
    );

    if (idx >= 0) {
      if (board.members[idx].role === BoardRole.OWNER) {
        throw new BadRequestException(
          'No se puede cambiar el rol del propietario desde aquí.',
        );
      }
      board.members[idx].role = dto.role;
    } else {
      board.members.push({
        user: new Types.ObjectId(dto.userId),
        role: dto.role,
      });
    }

    return board.save();
  }

  /**
   * Lista de personas del tablero con nombre y foto para mostrar en la UI.
   */
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

    for (const m of board.members as unknown as PopulatedMember[]) {
      const u = m.user;
      let uid: string;
      let username: string;
      let email: string;
      let avatarUrl: string | undefined;
      if (u && typeof u === 'object' && '_id' in u) {
        const doc = u as {
          _id: Types.ObjectId;
          username?: string;
          email?: string;
          avatarUrl?: string;
        };
        uid = doc._id.toString();
        username = doc.username ?? 'Usuario';
        email = doc.email ?? '';
        avatarUrl =
          doc.avatarUrl && String(doc.avatarUrl).trim() !== ''
            ? String(doc.avatarUrl)
            : undefined;
      } else {
        uid = (u as Types.ObjectId).toString();
        username = 'Usuario';
        email = '';
        avatarUrl = undefined;
      }
      rawRows.push({ userId: uid, username, email, avatarUrl, role: m.role });
    }

    type MemberRow = {
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      role: BoardRole;
    };
    const byId: Record<string, MemberRow> = {};
    for (const r of rawRows) {
      const prev = byId[r.userId];
      if (!prev || this.boardRoleRank(r.role) > this.boardRoleRank(prev.role)) {
        byId[r.userId] = r;
      }
    }

    const members = Object.values(byId).sort((a, b) => {
      if (a.userId === ownerId) return -1;
      if (b.userId === ownerId) return 1;
      return a.username.localeCompare(b.username, 'es', {
        sensitivity: 'base',
      });
    });

    return { ownerId, members };
  }

  /**
   * Saca a un miembro del tablero (no se puede echar al dueño).
   */
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

    const before = board.members.length;
    board.members = board.members.filter(
      (m) => m.user.toString() !== memberUserId,
    );
    if (board.members.length === before) {
      throw new NotFoundException('Ese usuario no es miembro del tablero.');
    }

    await board.save();
  }
}
