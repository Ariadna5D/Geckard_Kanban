import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../casl/casl-ability.factory';

/**
 * Indica de dónde sacamos el id del tablero en cada ruta (URL, cuerpo, tarea…).
 */
export enum BoardIdSource {
  ParamId = 'param.id',
  ParamBoardId = 'param.boardId',
  ParamSlug = 'param.slug',
  BodyBoardId = 'body.boardId',
  TaskParamId = 'task.param.id',
}

export type BoardPolicyHandler = (ability: AppAbility) => boolean;

export const BOARD_POLICY_HANDLERS_KEY = 'board_policy_handlers';
export const BOARD_ID_SOURCE_KEY = 'board_id_source';

export const CheckBoardPolicies = (...handlers: BoardPolicyHandler[]) =>
  SetMetadata(BOARD_POLICY_HANDLERS_KEY, handlers);

export const BoardIdFrom = (source: BoardIdSource) =>
  SetMetadata(BOARD_ID_SOURCE_KEY, source);
