import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import {
  BOARD_ID_SOURCE_KEY,
  BOARD_POLICY_HANDLERS_KEY,
  BoardIdSource,
  BoardPolicyHandler,
} from './board-policy.decorator';
import { BoardsService } from './boards.service';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import type { ValidatedRequest } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class BoardPolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly boardsService: BoardsService,
    private readonly caslFactory: CaslAbilityFactory,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  /**
   * Resuelve el tablero, el rol del usuario en él y aplica las políticas CASL de la ruta.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlersFromMetadata =
      this.reflector.getAllAndOverride<BoardPolicyHandler[]>(
        BOARD_POLICY_HANDLERS_KEY,
        [context.getHandler(), context.getClass()],
      );

    let boardPolicyHandlers: BoardPolicyHandler[] = [];
    if (handlersFromMetadata !== undefined && handlersFromMetadata !== null) {
      boardPolicyHandlers = handlersFromMetadata;
    }

    if (boardPolicyHandlers.length === 0) {
      return true;
    }

    const boardIdSource = this.reflector.getAllAndOverride<BoardIdSource>(
      BOARD_ID_SOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (boardIdSource === undefined || boardIdSource === null) {
      throw new ForbiddenException(
        'Esta ruta de tablero no está bien enlazada en el código.',
      );
    }

    const httpRequest = context.switchToHttp().getRequest<ValidatedRequest>();
    const authenticatedUser = httpRequest.user;

    const isApplicationAdmin = authenticatedUser.role === 'admin';
    if (isApplicationAdmin) {
      return true;
    }

    const boardId = await this.resolveBoardId(boardIdSource, httpRequest);
    const boardExists = await this.boardsService.boardExists(boardId);
    if (!boardExists) {
      throw new NotFoundException('El tablero no existe.');
    }

    const roleOnBoard = await this.boardsService.getEffectiveBoardRole(
      boardId,
      authenticatedUser.sub,
    );
    if (!roleOnBoard) {
      throw new ForbiddenException('No tienes acceso a este tablero.');
    }

    const abilityForMember = this.caslFactory.createForBoardMember(
      { userId: authenticatedUser.sub, role: authenticatedUser.role },
      roleOnBoard,
    );

    for (let index = 0; index < boardPolicyHandlers.length; index++) {
      const policyCheck = boardPolicyHandlers[index];
      const allowed = policyCheck(abilityForMember);
      if (!allowed) {
        throw new ForbiddenException('No tienes permiso para esta acción.');
      }
    }
    return true;
  }

  private normalizeRouteParam(
    value: string | string[] | undefined,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private async resolveBoardId(
    source: BoardIdSource,
    httpRequest: ValidatedRequest,
  ): Promise<string> {
    switch (source) {
      case BoardIdSource.ParamId: {
        const rawId = this.normalizeRouteParam(httpRequest.params['id']);
        if (!rawId || !Types.ObjectId.isValid(rawId)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return rawId;
      }
      case BoardIdSource.ParamBoardId: {
        const rawBoardId = this.normalizeRouteParam(
          httpRequest.params['boardId'],
        );
        if (!rawBoardId || !Types.ObjectId.isValid(rawBoardId)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return rawBoardId;
      }
      case BoardIdSource.ParamSlug: {
        const slugParam = this.normalizeRouteParam(httpRequest.params['slug']);
        if (!slugParam || slugParam.trim() === '') {
          throw new NotFoundException('El tablero no existe.');
        }
        const boardIdFromSlug = await this.boardsService.getBoardIdBySlug(
          slugParam.trim(),
        );
        if (!boardIdFromSlug) {
          throw new NotFoundException('El tablero no existe.');
        }
        return boardIdFromSlug;
      }
      case BoardIdSource.BodyBoardId: {
        const body = httpRequest.body as { boardId?: string };
        const rawBodyBoardId = body?.boardId;
        if (!rawBodyBoardId || !Types.ObjectId.isValid(rawBodyBoardId)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return rawBodyBoardId;
      }
      case BoardIdSource.TaskParamId: {
        const taskIdParam = this.normalizeRouteParam(httpRequest.params['id']);
        if (!taskIdParam || !Types.ObjectId.isValid(taskIdParam)) {
          throw new NotFoundException('Tarea no encontrada.');
        }
        const taskDocument = await this.taskModel
          .findById(taskIdParam)
          .select('boardId')
          .lean()
          .exec();
        if (!taskDocument || !taskDocument.boardId) {
          throw new NotFoundException('Tarea no encontrada.');
        }
        return taskDocument.boardId.toString();
      }
      default:
        throw new ForbiddenException('Origen de tablero no soportado.');
    }
  }
}
