import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import { UsersService } from '../users/users.service';
import { BoardActivityService } from './board-activity.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Board, BoardDocument, BoardRole } from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { BoardsPermissionsService } from './boards-permissions.service';

const FREE_PLAN_MAX_ACTIVITY_LOGS = 40;
const PRO_PLAN_MAX_ACTIVITY_LOGS = 120;
const TEAM_PLAN_MAX_ACTIVITY_LOGS = 200;

@Injectable()
export class BoardsCoreService {
  /**
   * Inyecta modelos y servicios base del nucleo de tableros
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
    private readonly boardActivityService: BoardActivityService,
    private readonly permissionsService: BoardsPermissionsService,
  ) {}

  /**
   * Busca email del actor para guardar trazas de actividad
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
   * Devuelve id del tablero cuando existe un slug valido
   */
  async getBoardIdBySlug(slug: string): Promise<string | null> {
    // Solo pedimos _id para no cargar datos de mas
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

  /**
   * Crea tablero nuevo con slug amigable y owner inicial
   */
  async create(
    createBoardDto: CreateBoardDto,
    userId: string,
  ): Promise<BoardDocument> {
    // Armamos slug legible y le sumamos sufijo para evitar choques
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
      // Si el slug choca por duplicado devolvemos mensaje controlado
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ConflictException('Error al crear tablero.');
      }
      throw new InternalServerErrorException('Error al crear tablero.');
    }
  }

  /**
   * Lista tableros accesibles para el usuario autenticado
   */
  async findAll(userId: string): Promise<BoardDocument[]> {
    const userObjectId = new Types.ObjectId(userId);
    // Devuelve los tableros donde participa o es owner el usuario
    return this.boardModel
      .find({
        $or: [{ owner: userObjectId }, { 'members.user': userObjectId }],
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * Actualiza datos de tablero y registra actividad del cambio
   */
  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string,
    isAdmin = false,
  ): Promise<BoardDocument> {
    // Valida permiso admin del tablero para editar ajustes generales
    await this.permissionsService.assertMinBoardRole(
      id,
      userId,
      BoardRole.ADMIN,
      isAdmin,
    );

    // Actualiza y devuelve el documento final ya guardado
    const updatedBoard = await this.boardModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id) }, updateBoardDto, {
        returnDocument: 'after',
      })
      .exec();

    if (!updatedBoard) {
      throw new NotFoundException('El tablero no existe.');
    }

    // Guarda traza para historial del tablero
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
   * Elimina tablero y todas las tareas asociadas
   */
  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    // Valida que solo owner o admin global pueda borrar el tablero
    await this.permissionsService.assertMinBoardRole(
      id,
      userId,
      BoardRole.OWNER,
      isAdmin,
    );

    const board = await this.boardModel
      .findOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }

    // Borra tareas antes para no dejar datos huerfanos
    await this.taskModel.deleteMany({ boardId: new Types.ObjectId(id) }).exec();
    await this.boardModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
  }

  /**
   * Lista actividad del tablero respetando limite por plan
   */
  async listBoardActivity(
    boardId: string,
    userId: string,
    isAppAdmin = false,
    limit = 60,
  ) {
    // Valida acceso para no filtrar actividad a terceros
    await this.permissionsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
    const board = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .select('owner')
      .exec();
    if (!board) {
      throw new NotFoundException('El tablero no existe.');
    }
    // Calcula limite real segun plan del owner del tablero
    const ownerUser = await this.usersService.findById(board.owner.toString());
    const ownerPlan = ownerUser?.userPlan ?? 'free';
    let planLimit = FREE_PLAN_MAX_ACTIVITY_LOGS;
    if (ownerPlan === 'pro') {
      planLimit = PRO_PLAN_MAX_ACTIVITY_LOGS;
    }
    if (ownerPlan === 'team') {
      planLimit = TEAM_PLAN_MAX_ACTIVITY_LOGS;
    }

    // Recorta limite pedido entre minimo y maximo del plan
    const safeLimit = Math.min(Math.max(limit, 1), planLimit);
    return this.boardActivityService.listByBoard(boardId, safeLimit);
  }
}
