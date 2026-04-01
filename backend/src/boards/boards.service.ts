import {
  Injectable,
  ConflictException,
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

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

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
   * Actualiza el tablero (solo el propietario, salvo administrador de la app).
   */
  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string,
    isAdmin = false,
  ): Promise<BoardDocument> {
    const filter = isAdmin
      ? { _id: new Types.ObjectId(id) }
      : {
          _id: new Types.ObjectId(id),
          owner: new Types.ObjectId(userId),
        };

    const updatedBoard = await this.boardModel
      .findOneAndUpdate(filter, updateBoardDto, {
        new: true,
      })
      .exec();

    if (!updatedBoard)
      throw new NotFoundException('No se encontró el tablero.');
    return updatedBoard;
  }

  /**
   * Borra el tablero y todas sus tareas (solo el propietario, salvo administrador).
   */
  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    const filter = isAdmin
      ? { _id: new Types.ObjectId(id) }
      : { _id: new Types.ObjectId(id), owner: new Types.ObjectId(userId) };

    const board = await this.boardModel.findOne(filter).exec();
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
    const filter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const board = await this.boardModel
      .findOneAndUpdate(
        filter as never,
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
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
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
    const filter = {
      ...this.boardAccessFilter(boardId, userId, isAppAdmin),
      'columns._id': new Types.ObjectId(columnId),
    };
    const board = await this.boardModel
      .findOneAndUpdate(
        filter as never,
        { $set: { 'columns.$.title': title } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException(
        'La columna no existe o no tienes permiso en este tablero.',
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
    const filter = {
      ...this.boardAccessFilter(boardId, userId, isAppAdmin),
      'columns._id': new Types.ObjectId(columnId),
    };
    const board = await this.boardModel
      .findOneAndUpdate(
        filter as never,
        { $set: { 'columns.$.order': order } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException(
        'La columna no existe o no tienes permiso en este tablero.',
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
    const filter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const board = await this.boardModel
      .findOneAndUpdate(
        filter as never,
        { $pull: { columns: { _id: new Types.ObjectId(columnId) } } },
        { new: true },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
    }

    await this.taskModel
      .deleteMany({ columnId: new Types.ObjectId(columnId) })
      .exec();

    return board;
  }
}
