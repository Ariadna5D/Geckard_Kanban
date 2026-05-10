import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { User } from '../users/schemas/user.schema';
import { Board, BoardRole } from '../boards/schemas/board.schema';
import { Action } from './enums/action.enum';
import { Task } from '../tasks/schemas/task.schema';

/**
 * Agrupa recursos internos del tablero
 */
export const BoardSubject = {
  Settings: 'BoardSettings',
  Members: 'BoardMembers',
  Columns: 'BoardColumns',
} as const;

export type BoardFineSubject = (typeof BoardSubject)[keyof typeof BoardSubject];

type Subjects =
  | InferSubjects<typeof User | typeof Board | typeof Task>
  | BoardFineSubject
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

export type JwtAuthUser = {
  userId: string;
  role: string;
};

type SubjectWithConstructor = {
  constructor?: unknown;
};

/**
 * Detecta tipo de sujeto para CASL
 */
function detectSubjectTypeForAbility(
  item: unknown,
): ExtractSubjectType<Subjects> {
  if (item === null || item === undefined) {
    return 'all' as ExtractSubjectType<Subjects>;
  }

  if (typeof item === 'string') {
    return item as ExtractSubjectType<Subjects>;
  }

  if (typeof item === 'object') {
    const subjectValue = item as SubjectWithConstructor;
    if (
      subjectValue.constructor !== undefined &&
      subjectValue.constructor !== null
    ) {
      return subjectValue.constructor as ExtractSubjectType<Subjects>;
    }
  }

  return 'all' as ExtractSubjectType<Subjects>;
}

/**
 * Fabrica de permisos CASL
 */
@Injectable()
export class CaslAbilityFactory {
  /**
   * Crea permisos base del usuario
   */
  createForUser(user: JwtAuthUser): AppAbility {
    const abilityBuilder = new AbilityBuilder<AppAbility>(createMongoAbility);

    const isApplicationAdmin = user.role === 'admin';

    if (isApplicationAdmin) {
      // Admin global puede gestionar cualquier recurso
      abilityBuilder.can(Action.Manage, 'all');
    } else {
      // Usuario normal puede leer y crear tableros
      abilityBuilder.can(Action.Read, Board);
      abilityBuilder.can(Action.Create, Board);
      // Si es owner puede editar y borrar su tablero
      abilityBuilder.can(Action.Update, Board, { owner: user.userId });
      abilityBuilder.can(Action.Delete, Board, { owner: user.userId });

      // Tareas se controlan luego con guardas por tablero
      abilityBuilder.can(Action.Read, Task);
      abilityBuilder.can(Action.Create, Task);
      abilityBuilder.can(Action.Update, Task);
      abilityBuilder.can(Action.Delete, Task);
    }

    return abilityBuilder.build({
      detectSubjectType: detectSubjectTypeForAbility,
    });
  }

  /**
   * Crea permisos dentro de un tablero
   */
  createForBoardMember(user: JwtAuthUser, roleOnBoard: BoardRole): AppAbility {
    const abilityBuilder = new AbilityBuilder<AppAbility>(createMongoAbility);

    const isApplicationAdmin = user.role === 'admin';
    if (isApplicationAdmin) {
      // Si es admin global no se limita por rol interno
      abilityBuilder.can(Action.Manage, 'all');
      return abilityBuilder.build({
        detectSubjectType: detectSubjectTypeForAbility,
      });
    }

    abilityBuilder.can(Action.Read, Board);
    abilityBuilder.can(Action.Read, Task);

    const isViewerOnly = roleOnBoard === BoardRole.VIEWER;
    if (isViewerOnly) {
      // Viewer solo lee tablero y tareas
      return abilityBuilder.build({
        detectSubjectType: detectSubjectTypeForAbility,
      });
    }

    const canEditContent =
      roleOnBoard === BoardRole.EDITOR ||
      roleOnBoard === BoardRole.ADMIN ||
      roleOnBoard === BoardRole.OWNER;

    if (canEditContent) {
      abilityBuilder.can(Action.Update, BoardSubject.Columns);
      abilityBuilder.can(Action.Create, Task);
      abilityBuilder.can(Action.Update, Task);
      abilityBuilder.can(Action.Delete, Task);
    }

    const isBoardAdminOrOwner =
      roleOnBoard === BoardRole.ADMIN || roleOnBoard === BoardRole.OWNER;

    if (isBoardAdminOrOwner) {
      abilityBuilder.can(Action.Update, BoardSubject.Settings);
      abilityBuilder.can(Action.Update, BoardSubject.Members);
    }

    const isBoardOwner = roleOnBoard === BoardRole.OWNER;
    if (isBoardOwner) {
      // Solo owner puede borrar tablero completo
      abilityBuilder.can(Action.Delete, Board);
    }

    return abilityBuilder.build({
      detectSubjectType: detectSubjectTypeForAbility,
    });
  }
}
