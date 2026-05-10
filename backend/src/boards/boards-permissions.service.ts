import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Board, BoardDocument, BoardRole } from './schemas/board.schema';

@Injectable()
export class BoardsPermissionsService {
  /**
   * Inyecta modelo de tableros para validaciones de acceso
   */
  constructor(
    @InjectModel(Board.name) private readonly boardModel: Model<BoardDocument>,
  ) {}

  /**
   * Convierte cada rol a nivel numerico para comparar permisos
   */
  private boardRoleRank(boardRole: BoardRole): number {
    switch (boardRole) {
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
   * Arma filtro base por owner, miembro o admin global
   */
  private boardAccessFilter(
    boardId: string,
    userId: string,
    isAppAdmin: boolean,
  ): QueryFilter<BoardDocument> {
    const boardObjectId = new Types.ObjectId(boardId);
    let result: QueryFilter<BoardDocument> = { _id: boardObjectId };
    if (isAppAdmin) {
      return result;
    }
    const requestingUserObjectId = new Types.ObjectId(userId);
    result = {
      _id: boardObjectId,
      $or: [
        { owner: requestingUserObjectId },
        { 'members.user': requestingUserObjectId },
      ],
    };
    return result;
  }

  /**
   * Confirma si existe un tablero por id valido
   */
  async boardExists(boardId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(boardId)) {
      return false;
    }
    const matchingCount = await this.boardModel
      .countDocuments({ _id: new Types.ObjectId(boardId) })
      .exec();
    return matchingCount > 0;
  }

  /**
   * Devuelve el rol real del usuario dentro del tablero
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

  /**
   * Valida rol minimo para ejecutar la accion pedida
   */
  async assertMinBoardRole(
    boardId: string,
    userId: string,
    minimum: BoardRole,
    isAppAdmin = false,
  ): Promise<void> {
    if (isAppAdmin) return;
    // Busca rol real para validar minimo pedido por la accion
    const role = await this.getEffectiveBoardRole(boardId, userId);
    if (!role || this.boardRoleRank(role) < this.boardRoleRank(minimum)) {
      throw new ForbiddenException(
        'No tienes permiso suficiente en este tablero.',
      );
    }
  }

  /**
   * Valida acceso basico al tablero sin cargar todo el docuemnto
   */
  async assertUserHasBoardAccess(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    // Count rapido para confirmar acceso
    const filter = this.boardAccessFilter(boardId, userId, isAppAdmin);
    const matchingCount = await this.boardModel.countDocuments(filter).exec();
    if (matchingCount === 0) {
      throw new NotFoundException('El tablero no existe o no tienes permiso.');
    }
  }

  /**
   * Valida que la columna exista dentro del tablero accesible
   */
  async assertBoardHasColumn(
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

  /**
   * Valida si una tarea puede entrar al sprint actual
   */
  async assertTaskCanJoinSprint(
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

    // Reutiliza el mismo filtro de acceso para revisar estado del tablero
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

    let activeSprintIdString = '';
    if (
      boardLean.activeSprintId !== undefined &&
      boardLean.activeSprintId !== null
    ) {
      activeSprintIdString = boardLean.activeSprintId.toString();
    }

    // Solo se permite usar el sprint activo de ese tablero
    if (!activeSprintIdString || activeSprintIdString !== sprintId) {
      throw new BadRequestException(
        'Solo puedes asignar la tarea al sprint activo del tablero.',
      );
    }
  }
}
