import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Board, BoardDocument, BoardRole } from './schemas/board.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import slugify from 'slugify';
import { MongoServerError } from 'mongodb';

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
  ) {}

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
        members: [
          {
            user: new Types.ObjectId(userId),
            role: BoardRole.OWNER,
          },
        ],
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

  async findAll(userId: string): Promise<BoardDocument[]> {
    // 1. TRANSFORMACIÓN DE CAPA: Convertimos el ID de la capa HTTP (String)
    // al tipo nativo de la capa de Infraestructura (ObjectId) de forma explícita.
    // Esto evita el fallo histórico de Mongoose con el auto-casting en arrays.
    const userObjectId = new Types.ObjectId(userId);

    return this.boardModel
      .find({
        // 2. CONSULTA DEFENSIVA ($or): En sistemas tipo Linear/Trello, garantizamos
        // la visibilidad si eres el creador explícito O si figuras en la lista de miembros.
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findOneBySlug(slug: string, userId: string): Promise<BoardDocument> {
    const userObjectId = new Types.ObjectId(userId);

    const board = await this.boardModel
      .findOne({
        slug,
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .populate('columns.tasks')
      .exec();

    if (!board) {
      throw new NotFoundException(
        `El tablero con slug ${slug} no existe o no tienes permiso para verlo.`,
      );
    }
    return board;
  }

  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string, // <-- NUEVO: Recibimos el userId
  ): Promise<BoardDocument> {
    const updatedBoard = await this.boardModel
      .findOneAndUpdate(
        {
          _id: id,
          owner: userId, // <-- SEGURIDAD: Solo si eres el owner original
        },
        updateBoardDto,
        { new: true },
      )
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException(
        'No se encontró el tablero o no tienes permisos de OWNER para modificarlo.',
      );
    }
    return updatedBoard;
  }

  async remove(id: string, userId: string): Promise<void> {
    // <-- NUEVO: Recibimos userId
    const result = await this.boardModel
      .deleteOne({
        _id: id,
        owner: userId, // <-- SEGURIDAD: Solo el owner puede fulminar el tablero
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        'No se pudo eliminar el tablero. O no existe, o no eres el OWNER.',
      );
    }
  }
}
