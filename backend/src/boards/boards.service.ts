import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Board, BoardDocument, BoardRole } from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema'; // <-- IMPORTAMOS TASK
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import slugify from 'slugify';
import { MongoServerError } from 'mongodb';
import { CreateColumnDto } from './dto/create-column.dto';

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>, // <-- INYECTAMOS EL MODELO
  ) {}

  /**
   * Creates a new board, generates a unique slug, and sets the creator as OWNER.
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
          'Hubo un problema al generar la URL del tablero. Inténtalo de nuevo.',
        );
      }
      throw new InternalServerErrorException(
        'Error fatal al crear el tablero.',
      );
    }
  }

  /**
   * Retrieves all boards where the user is either the owner or a member.
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
   * Retrieves a specific board by its slug, including populated tasks.
   */
  /**
   * Retrieves a specific board by its slug, and stitches its tasks manually
   * to avoid fragile array synchronizations.
   */
  /**
   * Retrieves a specific board by its slug, and stitches its tasks manually
   * returning a new object to satisfy strict TypeScript typings.
   */
  async findOneBySlug(slug: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // 1. Traemos el tablero
    const boardDoc = await this.boardModel
      .findOne({
        slug,
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .lean()
      .exec();

    if (!boardDoc) {
      throw new NotFoundException(
        `El tablero con slug ${slug} no existe o no tienes permiso para verlo.`,
      );
    }

    // 2. Traemos las tareas
    const tasks = await this.taskModel
      .find({ boardId: boardDoc._id })
      .lean()
      .exec();

    // 3. Construimos y devolvemos un objeto NUEVO.
    // Al no mutar boardDoc, TypeScript no se queja de los tipos.
    return {
      ...boardDoc,
      columns: boardDoc.columns.map((column) => ({
        ...column,
        // Usamos as any solo para leer el _id implícito del subdocumento de Mongoose
        tasks: tasks.filter(
          (task) => task.columnId.toString() === (column as any)._id.toString(),
        ),
      })),
    };
  }

  /**
   * Updates basic board details if the user is the original owner.
   */
  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string,
  ): Promise<BoardDocument> {
    const updatedBoard = await this.boardModel
      .findOneAndUpdate({ _id: id, owner: userId }, updateBoardDto, {
        returnDocument: 'after',
      })
      .exec();

    if (!updatedBoard)
      throw new NotFoundException(
        'No se encontró el tablero o no tienes permisos de OWNER.',
      );
    return updatedBoard;
  }

  /**
   * Permanently deletes a board if the user is the original owner.
   */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.boardModel
      .deleteOne({ _id: id, owner: userId })
      .exec();
    if (result.deletedCount === 0)
      throw new NotFoundException('No se pudo eliminar el tablero.');
  }

  // --- GESTIÓN DE COLUMNAS (SUBDOCUMENTOS) ---

  /**
   * Appends a new column sub-document to the board's columns array.
   */
  async addColumn(
    boardId: string,
    createColumnDto: CreateColumnDto,
  ): Promise<BoardDocument> {
    const board = await this.boardModel
      .findByIdAndUpdate(
        boardId,
        {
          $push: {
            columns: {
              _id: new Types.ObjectId(),
              title: createColumnDto.title,
              tasks: [],
            },
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!board) throw new NotFoundException('Tablero no encontrado');
    return board;
  }

  /**
   * Updates the title of an existing column within the board.
   */
  async updateColumn(
    boardId: string,
    columnId: string,
    title: string,
  ): Promise<BoardDocument> {
    const board = await this.boardModel
      .findOneAndUpdate(
        { _id: boardId, 'columns._id': new Types.ObjectId(columnId) },
        { $set: { 'columns.$.title': title } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!board) throw new NotFoundException('Tablero o Columna no encontrada');
    return board;
  }

  /**
   * CASCADE DELETE: Removes a column from the board AND destroys all orphaned tasks.
   */
  async removeColumn(
    boardId: string,
    columnId: string,
  ): Promise<BoardDocument> {
    // 1. Sacamos la columna del array
    const board = await this.boardModel
      .findByIdAndUpdate(
        boardId,
        { $pull: { columns: { _id: new Types.ObjectId(columnId) } } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!board) throw new NotFoundException('Tablero no encontrado');

    // 2. Borrado masivo de tareas huérfanas (Cascada)
    await this.taskModel
      .deleteMany({ columnId: new Types.ObjectId(columnId) })
      .exec();

    return board;
  }
}
