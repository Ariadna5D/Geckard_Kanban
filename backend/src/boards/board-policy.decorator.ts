import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../casl/casl-ability.factory';

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

/**
 * Guarda handlers de permisos para la ruta
 */
export function CheckBoardPolicies(...handlers: BoardPolicyHandler[]) {
  // Guarda handlers para que el guard los ejecute
  return SetMetadata(BOARD_POLICY_HANDLERS_KEY, handlers);
}

/**
 * Define de donde sale el boardId
 */
export function BoardIdFrom(source: BoardIdSource) {
  // Define de donde sale boardId en este endpoint
  return SetMetadata(BOARD_ID_SOURCE_KEY, source);
}
