import { Injectable } from '@nestjs/common';
import { BoardDocument, BoardRole } from './schemas/board.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { InviteBoardMemberDto } from './dto/invite-board-member.dto';
import { UpdateColumnBodyDto } from './dto/update-column-body.dto';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateActiveSprintDto } from './dto/update-active-sprint.dto';
import { UpdateClosedSprintDto } from './dto/update-closed-sprint.dto';
import { BoardsPermissionsService } from './boards-permissions.service';
import { BoardsMembersService } from './boards-members.service';
import { BoardsColumnsService } from './boards-columns.service';
import { BoardsSprintsService } from './boards-sprints.service';
import { BoardsCoreService } from './boards-core.service';
import { BoardsQueryService } from './boards-query.service';

@Injectable()
export class BoardsService {
  /**
   * Fachada del modulo boards que delega en servicios de dominio
   */
  constructor(
    private readonly permissionsService: BoardsPermissionsService,
    private readonly membersService: BoardsMembersService,
    private readonly columnsService: BoardsColumnsService,
    private readonly sprintsService: BoardsSprintsService,
    private readonly coreService: BoardsCoreService,
    private readonly queryService: BoardsQueryService,
  ) {}

  /**
   * Comprueba si existe un tablero por id
   */
  async boardExists(boardId: string): Promise<boolean> {
    return this.permissionsService.boardExists(boardId);
  }

  /**
   * Busca id de tablero usando slug
   */
  async getBoardIdBySlug(slug: string): Promise<string | null> {
    return this.coreService.getBoardIdBySlug(slug);
  }

  /**
   * Devuelve rol real del usuario dentro del tablero
   */
  async getEffectiveBoardRole(
    boardId: string,
    userId: string,
  ): Promise<BoardRole | null> {
    return this.permissionsService.getEffectiveBoardRole(boardId, userId);
  }

  /**
   * Valida que el usuario tenga rol minimo requerido
   */
  async assertMinBoardRole(
    boardId: string,
    userId: string,
    minimum: BoardRole,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertMinBoardRole(
      boardId,
      userId,
      minimum,
      isAppAdmin,
    );
  }

  /**
   * Valida que el usuario pueda acceder al tablero
   */
  async assertUserHasBoardAccess(
    boardId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertUserHasBoardAccess(
      boardId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Valida que la columna pertenezca al tablero
   */
  async assertBoardHasColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertBoardHasColumn(
      boardId,
      columnId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Devuelve titulo de columna para consultas puntuales
   */
  async getColumnTitle(
    boardId: string,
    columnId: string,
  ): Promise<string | null> {
    return this.columnsService.getColumnTitle(boardId, columnId);
  }

  /**
   * Valida si una tarea se puede asociar al sprint indicado
   */
  async assertTaskCanJoinSprint(
    boardId: string,
    sprintId: string | null | undefined,
    userId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.permissionsService.assertTaskCanJoinSprint(
      boardId,
      sprintId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Crea tablero nuevo con slug unico
   */
  async create(
    createBoardDto: CreateBoardDto,
    userId: string,
  ): Promise<BoardDocument> {
    return this.coreService.create(createBoardDto, userId);
  }

  /**
   * Lista tableros accesibles ordenados por ultima actualizacion
   */
  async findAll(userId: string): Promise<BoardDocument[]> {
    return this.coreService.findAll(userId);
  }

  /**
   * Obtiene tablero por slug con columnas y tareas visibles
   */
  async findOneBySlug(slug: string, userId: string) {
    return this.queryService.findOneBySlug(slug, userId);
  }

  /**
   * Actualiza ajustes principales del tablero
   */
  async update(
    id: string,
    updateBoardDto: UpdateBoardDto,
    userId: string,
    isAdmin = false,
  ): Promise<BoardDocument> {
    return this.coreService.update(id, updateBoardDto, userId, isAdmin);
  }

  /**
   * Elimina tablero junto con tareas asociadas
   */
  async remove(id: string, userId: string, isAdmin = false): Promise<void> {
    await this.coreService.remove(id, userId, isAdmin);
  }

  /**
   * Agrega columna nueva al tablero
   */
  async addColumn(
    boardId: string,
    createColumnDto: CreateColumnDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.columnsService.addColumn(
      boardId,
      createColumnDto,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Actualiza nombre o tipo de una columna
   */
  async updateColumn(
    boardId: string,
    columnId: string,
    body: UpdateColumnBodyDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.columnsService.updateColumn(
      boardId,
      columnId,
      body,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Guarda nuevo orden de columna luego de moverla
   */
  async updateColumnPosition(
    boardId: string,
    columnId: string,
    order: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.columnsService.updateColumnPosition(
      boardId,
      columnId,
      order,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Archiva columna y tareas activas de esa columna
   */
  async archiveColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    const data = await this.columnsService.archiveColumn(
      boardId,
      columnId,
      userId,
      isAppAdmin,
    );
    return this.findOneBySlug(data, userId);
  }

  /**
   * Restaura columna archivada y tareas vinculadas
   */
  async restoreColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    const data = await this.columnsService.restoreColumn(
      boardId,
      columnId,
      userId,
      isAppAdmin,
    );
    return this.findOneBySlug(data, userId);
  }

  /**
   * Elimina columna archivada y sus tareas de forma final
   */
  async removeColumn(
    boardId: string,
    columnId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<unknown> {
    const data = await this.columnsService.removeColumn(
      boardId,
      columnId,
      userId,
      isAppAdmin,
    );
    return this.findOneBySlug(data, userId);
  }

  /**
   * Crea sprint nuevo cuando el tablero lo permite
   */
  async createSprint(
    boardId: string,
    createSprintDto: CreateSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.createSprint(
      boardId,
      createSprintDto,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Cierra sprint activo y guarda resumen historico
   */
  async closeSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.closeSprint(
      boardId,
      sprintId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Actualiza datos editables del sprint activo
   */
  async updateActiveSprint(
    boardId: string,
    sprintId: string,
    dto: UpdateActiveSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.updateActiveSprint(
      boardId,
      sprintId,
      dto,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Cancela sprint activo sin guardar historial
   */
  async cancelActiveSprint(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.cancelActiveSprint(
      boardId,
      sprintId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Renombra sprint cerrado del historial
   */
  async updateClosedSprintRecord(
    boardId: string,
    sprintId: string,
    dto: UpdateClosedSprintDto,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.updateClosedSprintRecord(
      boardId,
      sprintId,
      dto,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Elimina sprint cerrado del historial
   */
  async deleteClosedSprintRecord(
    boardId: string,
    sprintId: string,
    userId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.sprintsService.deleteClosedSprintRecord(
      boardId,
      sprintId,
      userId,
      isAppAdmin,
    );
  }

  /**
   * Invita usuario o actualiza su rol en el tablero
   */
  async inviteMember(
    boardId: string,
    dto: InviteBoardMemberDto,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<BoardDocument> {
    return this.membersService.inviteMember(
      boardId,
      dto,
      actorUserId,
      isAppAdmin,
    );
  }

  /**
   * Lista miembros del tablero con rol actual
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
    return this.membersService.listMembers(boardId, userId, isAppAdmin);
  }

  /**
   * Lista actividad del tablero con limite aplicado
   */
  async listBoardActivity(
    boardId: string,
    userId: string,
    isAppAdmin = false,
    limit = 60,
  ) {
    return this.coreService.listBoardActivity(
      boardId,
      userId,
      isAppAdmin,
      limit,
    );
  }

  /**
   * Expulsa miembro del tablero
   */
  async removeMember(
    boardId: string,
    memberUserId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.membersService.removeMember(
      boardId,
      memberUserId,
      actorUserId,
      isAppAdmin,
    );
  }

  /**
   * Permite que un miembro abandone el tablero por su cuenta
   */
  async leaveBoard(
    boardId: string,
    actorUserId: string,
    isAppAdmin = false,
  ): Promise<void> {
    await this.membersService.leaveBoard(boardId, actorUserId, isAppAdmin);
  }
}
