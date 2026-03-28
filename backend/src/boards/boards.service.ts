import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// Añadido BoardDocument aquí
import { Board, BoardDocument, BoardRole } from './schemas/board.schema';
import { CreateBoardDto } from './dto/create-board.dto';
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
      if (error instanceof MongoServerError) {
        if (error.code === 11000) {
          throw new ConflictException(
            'Hubo un problema al generar la URL del tablero. Inténtalo de nuevo.',
          );
        }
      }

      throw new InternalServerErrorException(
        'Error fatal al crear el tablero.',
      );
    }
  }

  async findAll(userId: string): Promise<BoardDocument[]> {
    return this.boardModel
      .find({
        'members.user': new Types.ObjectId(userId),
      })
      .sort({ updatedAt: -1 })
      .exec();
  }
}
