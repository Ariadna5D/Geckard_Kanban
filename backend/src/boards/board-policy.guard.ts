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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.getAllAndOverride<BoardPolicyHandler[]>(
        BOARD_POLICY_HANDLERS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (handlers.length === 0) {
      return true;
    }

    const source = this.reflector.getAllAndOverride<BoardIdSource>(
      BOARD_ID_SOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (source === undefined) {
      throw new ForbiddenException(
        'Falta metadata BoardIdFrom en la ruta protegida.',
      );
    }

    const req = context.switchToHttp().getRequest<ValidatedRequest>();
    const user = req.user;

    if (user.role === 'admin') {
      return true;
    }

    const boardId = await this.resolveBoardId(source, req);
    const boardExists = await this.boardsService.boardExists(boardId);
    if (!boardExists) {
      throw new NotFoundException('El tablero no existe.');
    }

    const roleOnBoard = await this.boardsService.getEffectiveBoardRole(
      boardId,
      user.sub,
    );
    if (!roleOnBoard) {
      throw new ForbiddenException('No tienes acceso a este tablero.');
    }

    const ability = this.caslFactory.createForBoardMember(
      { userId: user.sub, role: user.role },
      roleOnBoard,
    );

    const ok = handlers.every((h) => h(ability));
    if (!ok) {
      throw new ForbiddenException('No tienes permiso para esta acción.');
    }
    return true;
  }

  private asParamString(v: string | string[] | undefined): string | undefined {
    if (v === undefined) return undefined;
    return Array.isArray(v) ? v[0] : v;
  }

  private async resolveBoardId(
    source: BoardIdSource,
    req: ValidatedRequest,
  ): Promise<string> {
    switch (source) {
      case BoardIdSource.ParamId: {
        const raw = this.asParamString(req.params['id']);
        if (!raw || !Types.ObjectId.isValid(raw)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return raw;
      }
      case BoardIdSource.ParamBoardId: {
        const raw = this.asParamString(req.params['boardId']);
        if (!raw || !Types.ObjectId.isValid(raw)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return raw;
      }
      case BoardIdSource.ParamSlug: {
        const slug = this.asParamString(req.params['slug']);
        if (!slug?.trim()) {
          throw new NotFoundException('El tablero no existe.');
        }
        const id = await this.boardsService.getBoardIdBySlug(slug.trim());
        if (!id) throw new NotFoundException('El tablero no existe.');
        return id;
      }
      case BoardIdSource.BodyBoardId: {
        const raw = (req.body as { boardId?: string })?.boardId;
        if (!raw || !Types.ObjectId.isValid(raw)) {
          throw new NotFoundException('Identificador de tablero no válido.');
        }
        return raw;
      }
      case BoardIdSource.TaskParamId: {
        const taskId = this.asParamString(req.params['id']);
        if (!taskId || !Types.ObjectId.isValid(taskId)) {
          throw new NotFoundException('Tarea no encontrada.');
        }
        const task = await this.taskModel
          .findById(taskId)
          .select('boardId')
          .lean()
          .exec();
        if (!task?.boardId) {
          throw new NotFoundException('Tarea no encontrada.');
        }
        return task.boardId.toString();
      }
      default:
        throw new ForbiddenException('Origen de tablero no soportado.');
    }
  }
}
