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

  private boardRoleRank(r: BoardRole): number {
    const order: Record<BoardRole, number> = {
      [BoardRole.VIEWER]: 1,
      [BoardRole.EDITOR]: 2,
      [BoardRole.ADMIN]: 3,
      [BoardRole.OWNER]: 4,
    };
    return order[r];
  }

  async boardExists(boardId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(boardId)) return false;
    const n = await this.boardModel
      .countDocuments({ _id: new Types.ObjectId(boardId) })
      .exec();
    return n > 0;
  }

  async getBoardIdBySlug(slug: string): Promise<string | null> {
    const b = await this.boardModel
      .findOne({ slug })
      .select('_id')
      .lean()
      .exec();
    return b?._id?.toString() ?? null;
  }

  /**
   * Rol efectivo del usuario en el tablero (owner cuenta como OWNER aunque también esté en members).
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
    const m = board.members.find((x) => x.user.toString() === userId);
    return m?.role ?? null;
  }

  /**
   * Requiere al menos el rol indicado (owner > admin > editor > viewer).
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
   * Filtro Mongo: tablero por id y usuario miembro (owner o members[]) o admin de la app.
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
   * Comprueba que el usuario pertenezca al tablero (o sea admin global).
   * Mismo mensaje que findOneBySlug para no filtrar si el tablero existe.
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
   * Comprueba que la columna pertenezca al tablero y el usuario tenga acceso al tablero.
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
   * Crea un nuevo tablero.
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
   * Obtiene todos los tableros del usuario.
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
   * Obtiene un tablero por su slug y mapea sus tareas dentro de las columnas.
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
          tasks: tasks.filter(
            (task) => task.columnId.toString() === col._id.toString(),
          ),
        };
      }),
    };
  }

  /**
   * Actualiza título/descripción (owner o admin del tablero; admin de la app).
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
   * Borra el tablero y todas sus tareas (solo owner; admin de la app).
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
   * Añade una nueva columna al final.
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
   * Actualiza el título de una columna.
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
   * Actualiza la posición (Fractional Index) de una columna.
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
   * Borrado en cascada: Elimina la columna y todas sus tareas.
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
   * Invita o actualiza el rol de un miembro.
   * Solo: propietario del tablero, miembro con rol `admin` en el tablero, o admin de la aplicación.
   * No: `editor` ni `viewer` (assertMinBoardRole(ADMIN) + CASL BoardMembers).
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
      throw new BadRequestException('El propietario ya tiene acceso al tablero.');
    }

    const idx = board.members.findIndex(
      (m) => m.user.toString() === dto.userId,
    );

    if (idx >= 0) {
      if (board.members[idx].role === BoardRole.OWNER) {
        throw new BadRequestException('No se puede cambiar el rol del propietario desde aquí.');
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
   * Lista miembros con username/email (cualquier miembro del tablero puede leer).
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

    const byId = new Map<
      string,
      {
        userId: string;
        username: string;
        email: string;
        avatarUrl?: string;
        role: BoardRole;
      }
    >();
    for (const r of rawRows) {
      const prev = byId.get(r.userId);
      if (!prev || this.boardRoleRank(r.role) > this.boardRoleRank(prev.role)) {
        byId.set(r.userId, r);
      }
    }

    const members = [...byId.values()].sort((a, b) => {
      if (a.userId === ownerId) return -1;
      if (b.userId === ownerId) return 1;
      return a.username.localeCompare(b.username, 'es', {
        sensitivity: 'base',
      });
    });

    return { ownerId, members };
  }

  /**
   * Expulsa a un miembro (no al propietario). Requiere admin del tablero o admin de la app.
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
