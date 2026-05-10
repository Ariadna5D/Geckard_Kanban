import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Board,
  BoardColumn,
  BoardColumnKind,
  BoardDocument,
  BoardRole,
} from './schemas/board.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnBodyDto } from './dto/update-column-body.dto';
import { BoardActivityService } from './board-activity.service';
import { UsersService } from '../users/users.service';
import { BoardsPermissionsService } from './boards-permissions.service';

@Injectable()
export class BoardsColumnsService {
  /**
   * Inyecta modelos y servicios para flujo de columnas
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly usersService: UsersService,
    private readonly boardActivityService: BoardActivityService,
    private readonly permissionsService: BoardsPermissionsService,
  ) {}

  /**
   * Busca email del actor para guardar actividad
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
   * Devuelve titulo de columna por id dentro del tablero
   */
  async getColumnTitle(
    boardId: string,
    columnId: string,
  ): Promise<string | null> {
    // Se consulta solo id y titulo para respuesta liviana
    const board = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .select('columns._id columns.title')
      .lean()
      .exec();
    if (!board) return null;
    const boardColumns = Array.isArray(board.columns)
      ? (board.columns as { _id: Types.ObjectId; title?: string }[])
      : [];
    for (let index = 0; index < boardColumns.length; index++) {
      const item = boardColumns[index];
      if (item._id.toString() === columnId) {
        const rawTitle = item.title;
        if (typeof rawTitle === 'string' && rawTitle.trim() !== '') {
          return rawTitle.trim();
        }
        return null;
      }
    }
    return null;
  }

  /**
   * Crea columna nueva y registra actividad del cambio
   */
  async addColumn(
    boardId: string,
    createColumnDto: CreateColumnDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Valida permiso editor para tocar estructura del tablero
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    // Normaliza titulo para evitar espacios raros al guardar
    const trimmedTitle = createColumnDto.title.trim();
    let initialColumnKind: BoardColumnKind = 'workflow';
    const normalizedTitle = trimmedTitle.toLowerCase();
    if (normalizedTitle === 'done' || normalizedTitle === 'hecho') {
      initialColumnKind = 'done';
    }

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
        { returnDocument: 'after' },
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
   * Edita nombre o tipo de una columna existente
   */
  async updateColumn(
    boardId: string,
    columnId: string,
    body: UpdateColumnBodyDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Valida permiso editor para tocar columnas
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    // Revisa que tablero y columna existan y que no este archivada
    const boardForValidation = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .exec();
    if (!boardForValidation) {
      throw new NotFoundException('El tablero no existe.');
    }
    let targetColumn: BoardColumn | null = null;
    for (let index = 0; index < boardForValidation.columns.length; index++) {
      const currentColumn = boardForValidation.columns[index];
      if (currentColumn._id.toString() === columnId) {
        targetColumn = currentColumn;
        break;
      }
    }
    if (!targetColumn) {
      throw new NotFoundException('La columna no existe.');
    }
    if (targetColumn.archivedAt != null) {
      throw new BadRequestException(
        'La columna esta archivada y no se puede editar.',
      );
    }

    if (body.title === undefined && body.columnKind === undefined) {
      throw new BadRequestException('No hay cambios para guardar.');
    }

    // Construye update solo con los campos que llegaron
    const fieldsToSet: Record<string, string> = {};
    if (body.title !== undefined) {
      const trimmedTitle = body.title.trim();
      if (!trimmedTitle) {
        throw new BadRequestException('El titulo no puede estar vacio.');
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
        { returnDocument: 'after' },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('La columna no existe.');
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
   * Cambia posicion de columna segun nueva clave de orden
   */
  async updateColumnPosition(
    boardId: string,
    columnId: string,
    order: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    // Valida permiso editor para tocar columnas
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      BoardRole.EDITOR,
      isAppAdmin,
    );
    // Revisa que tablero y columna existan y que no este archivada
    const boardForValidation = await this.boardModel
      .findById(new Types.ObjectId(boardId))
      .exec();
    if (!boardForValidation) {
      throw new NotFoundException('El tablero no existe.');
    }
    let targetColumn: BoardColumn | null = null;
    for (let index = 0; index < boardForValidation.columns.length; index++) {
      const currentColumn = boardForValidation.columns[index];
      if (currentColumn._id.toString() === columnId) {
        targetColumn = currentColumn;
        break;
      }
    }
    if (!targetColumn) {
      throw new NotFoundException('La columna no existe.');
    }
    if (targetColumn.archivedAt != null) {
      throw new BadRequestException(
        'La columna esta archivada y no se puede editar.',
      );
    }
    // Guarda nueva posicion para que el front pinte igual
    const board = await this.boardModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(boardId),
          'columns._id': new Types.ObjectId(columnId),
        },
        { $set: { 'columns.$.order': order } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!board) {
      throw new NotFoundException('La columna no existe.');
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
   * Archiva columna y archiva tareas activas relacionadas
   */
  async archiveColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<string> {
    await this.permissionsService.assertMinBoardRole(
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
    let columnSub: BoardColumn | null = null;
    for (let index = 0; index < board.columns.length; index++) {
      const currentColumn = board.columns[index];
      if (currentColumn._id.toString() === columnId) {
        columnSub = currentColumn;
        break;
      }
    }
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    if (columnSub.archivedAt != null) {
      return board.slug;
    }

    // Primero se archiva columna para sacarla del flujo normal
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

    // Luego se archivan tareas de esa columna para mantener consistencia
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

    return board.slug;
  }

  /**
   * Restaura columna archivada y sus tareas vinculadas
   */
  async restoreColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<string> {
    await this.permissionsService.assertMinBoardRole(
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
    let columnSub: BoardColumn | null = null;
    for (let index = 0; index < board.columns.length; index++) {
      const currentColumn = board.columns[index];
      if (currentColumn._id.toString() === columnId) {
        columnSub = currentColumn;
        break;
      }
    }
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    if (columnSub.archivedAt == null) {
      return board.slug;
    }

    await this.boardModel
      .updateOne(
        { _id: boardObjectId, 'columns._id': colObjectId },
        { $unset: { 'columns.$.archivedAt': '', 'columns.$.archivedBy': '' } },
      )
      .exec();

    // Restauramos solo tareas que se archivaron con esa columna
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

    return board.slug;
  }

  /**
   * Elimina columna archivada y borra tareas de forma final
   */
  async removeColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<string> {
    await this.permissionsService.assertMinBoardRole(
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
    let columnSub: BoardColumn | null = null;
    for (let index = 0; index < board.columns.length; index++) {
      const currentColumn = board.columns[index];
      if (currentColumn._id.toString() === columnId) {
        columnSub = currentColumn;
        break;
      }
    }
    if (!columnSub) {
      throw new NotFoundException('La columna no existe.');
    }
    // Si esta activa no se puede borrar directo en este flujo
    if (columnSub.archivedAt == null) {
      throw new BadRequestException('Primero archiva la columna.');
    }

    // Borramos tareas antes de quitar la columna del tablero
    await this.taskModel.deleteMany({ columnId: colObjectId }).exec();

    const updated = await this.boardModel
      .findOneAndUpdate(
        { _id: boardObjectId },
        { $pull: { columns: { _id: colObjectId } } },
        { returnDocument: 'after' },
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

    return board.slug;
  }
}
