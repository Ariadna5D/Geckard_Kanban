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

export function CheckBoardPolicies(...handlers: BoardPolicyHandler[]) {
  return SetMetadata(BOARD_POLICY_HANDLERS_KEY, handlers);
}

export function BoardIdFrom(source: BoardIdSource) {
  return SetMetadata(BOARD_ID_SOURCE_KEY, source);
}
