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
  /**
   * Inyecta dependencias para resolver tablero y evaluar permisos
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly boardsService: BoardsService,
    private readonly caslFactory: CaslAbilityFactory,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
  ) {}

  /**
   * Valida acceso y permisos de tablero antes de entrar al endpoint
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlersFromMetadata = this.reflector.getAllAndOverride<
      BoardPolicyHandler[]
    >(BOARD_POLICY_HANDLERS_KEY, [context.getHandler(), context.getClass()]);

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
      throw new ForbiddenException('Ruta no valida.');
    }

    const httpRequest = context.switchToHttp().getRequest<ValidatedRequest>();
    const authenticatedUser = httpRequest.user;

    const isApplicationAdmin = authenticatedUser.role === 'admin';
    if (isApplicationAdmin) {
      // Admin global pasa sin validar reglas de tablero en este punto
      return true;
    }

    // Resuelve boardId para validar acceso antes de evaluar politicas
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

    // Ejecuta handlers de permisos de la ruta uno por uno
    for (let index = 0; index < boardPolicyHandlers.length; index++) {
      const policyCheck = boardPolicyHandlers[index];
      const allowed = policyCheck(abilityForMember);
      if (!allowed) {
        throw new ForbiddenException('No tienes permiso para esta acción.');
      }
    }
    return true;
  }

  /**
   * Resuelve el boardId segun la fuente configurada en el decorador
   */
  private async resolveBoardId(
    source: BoardIdSource,
    httpRequest: ValidatedRequest,
  ): Promise<string> {
    switch (source) {
      case BoardIdSource.ParamId: {
        // Lee id desde params.id
        const rawParamId = httpRequest.params['id'];
        let boardIdFromParamId: string | undefined = undefined;
        if (Array.isArray(rawParamId)) {
          boardIdFromParamId = rawParamId[0];
        } else {
          boardIdFromParamId = rawParamId;
        }
        if (
          !boardIdFromParamId ||
          !Types.ObjectId.isValid(boardIdFromParamId)
        ) {
          throw new NotFoundException('Identificador de tablero no valido.');
        }
        return boardIdFromParamId;
      }
      case BoardIdSource.ParamBoardId: {
        // Lee id desde params.boardId
        const rawParamBoardId = httpRequest.params['boardId'];
        let boardIdFromParamBoardId: string | undefined = undefined;
        if (Array.isArray(rawParamBoardId)) {
          boardIdFromParamBoardId = rawParamBoardId[0];
        } else {
          boardIdFromParamBoardId = rawParamBoardId;
        }
        if (
          !boardIdFromParamBoardId ||
          !Types.ObjectId.isValid(boardIdFromParamBoardId)
        ) {
          throw new NotFoundException('Identificador de tablero no valido.');
        }
        return boardIdFromParamBoardId;
      }
      case BoardIdSource.ParamSlug: {
        // Lee slug desde params.slug
        const rawParamSlug = httpRequest.params['slug'];
        let slugParam: string | undefined = undefined;
        if (Array.isArray(rawParamSlug)) {
          slugParam = rawParamSlug[0];
        } else {
          slugParam = rawParamSlug;
        }
        if (!slugParam || slugParam.trim() === '') {
          throw new NotFoundException('El tablero no existe.');
        }
        // Busca el tablero por slug
        const boardIdFromSlug = await this.boardsService.getBoardIdBySlug(
          slugParam.trim(),
        );
        if (!boardIdFromSlug) {
          throw new NotFoundException('El tablero no existe.');
        }
        return boardIdFromSlug;
      }
      case BoardIdSource.BodyBoardId: {
        // Lee boardId del body cuando la ruta lo envia por payload
        const body = httpRequest.body as { boardId?: string };
        let rawBodyBoardId: string | undefined = undefined;
        if (body !== undefined && body !== null) {
          rawBodyBoardId = body.boardId;
        }
        if (!rawBodyBoardId || !Types.ObjectId.isValid(rawBodyBoardId)) {
          throw new NotFoundException('Identificador de tablero no valido.');
        }
        return rawBodyBoardId;
      }
      case BoardIdSource.TaskParamId: {
        // Lee id de tarea desde params.id
        const rawTaskIdParam = httpRequest.params['id'];
        let taskIdParam: string | undefined = undefined;
        if (Array.isArray(rawTaskIdParam)) {
          taskIdParam = rawTaskIdParam[0];
        } else {
          taskIdParam = rawTaskIdParam;
        }
        if (!taskIdParam || !Types.ObjectId.isValid(taskIdParam)) {
          throw new NotFoundException('Tarea no encontrada.');
        }
        // Busca la tarea para recuperar el tablero al que pertenece
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
        throw new ForbiddenException('Origen de tablero no valido.');
    }
  }
}
