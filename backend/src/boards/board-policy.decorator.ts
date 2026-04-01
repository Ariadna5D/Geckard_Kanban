import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../casl/casl-ability.factory';

export enum BoardIdSource {
  /** `GET/POST/PATCH/DELETE .../boards/:id/...` */
  ParamId = 'param.id',
  /** `GET .../tasks/board/:boardId` */
  ParamBoardId = 'param.boardId',
  /** `GET .../boards/by-slug/:slug` */
  ParamSlug = 'param.slug',
  /** Cuerpo `boardId` al crear tarea */
  BodyBoardId = 'body.boardId',
  /** `PATCH|DELETE .../tasks/:id` — resuelve `boardId` desde la tarea */
  TaskParamId = 'task.param.id',
}

export type BoardPolicyHandler = (ability: AppAbility) => boolean;

export const BOARD_POLICY_HANDLERS_KEY = 'board_policy_handlers';
export const BOARD_ID_SOURCE_KEY = 'board_id_source';

export const CheckBoardPolicies = (...handlers: BoardPolicyHandler[]) =>
  SetMetadata(BOARD_POLICY_HANDLERS_KEY, handlers);

export const BoardIdFrom = (source: BoardIdSource) =>
  SetMetadata(BOARD_ID_SOURCE_KEY, source);
