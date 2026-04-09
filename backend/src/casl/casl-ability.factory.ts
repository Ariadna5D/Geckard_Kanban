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
 * Objetos que revisar permisos
 */
export const BoardSubject = {
  Settings: 'BoardSettings',
  Members: 'BoardMembers',
  Columns: 'BoardColumns',
} as const;

// Tipo que representa los usuarios relacionados con tableros
export type BoardFineSubject = (typeof BoardSubject)[keyof typeof BoardSubject];

// Tipo de usuarios para CASL
type Subjects =
  | InferSubjects<typeof User | typeof Board | typeof Task>
  | BoardFineSubject
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

// Sacar info de JWT para CASL
export type JwtAuthUser = {
  userId: string;
  role: string;
};

/**
 * Detecta el tipo de sujeto para la capacidad de CASL
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
    const record = item as { constructor?: unknown };
    if (record.constructor !== undefined && record.constructor !== null) {
      return record.constructor as ExtractSubjectType<Subjects>;
    }
  }

  return 'all' as ExtractSubjectType<Subjects>;
}

// Fábrica de habilidades de CASL para generar permisos según el rol del usuario
@Injectable()
export class CaslAbilityFactory {
  /**
   * PERMISOS GENERALES
   */
  createForUser(user: JwtAuthUser): AppAbility {
    const abilityBuilder = new AbilityBuilder<AppAbility>(createMongoAbility);

    const isApplicationAdmin = user.role === 'admin'; // Si el usuario es admin a nivel de aplicación, le damos permiso total

    if (isApplicationAdmin) {
      abilityBuilder.can(Action.Manage, 'all');
    } else {
      //TABLEROS
      abilityBuilder.can(Action.Read, Board);
      abilityBuilder.can(Action.Create, Board);
      abilityBuilder.can(Action.Update, Board, { owner: user.userId }); // Solo puede actualizar tableros que posea
      abilityBuilder.can(Action.Delete, Board, { owner: user.userId }); // Solo puede eliminar tableros que posea

      //TAREAS
      abilityBuilder.can(Action.Read, Task);
      abilityBuilder.can(Action.Create, Task);
      abilityBuilder.can(Action.Update, Task);
      abilityBuilder.can(Action.Delete, Task);
    }

    return abilityBuilder.build({
      detectSubjectType: detectSubjectTypeForAbility,
    });
  }

  // PERMISOS EN TABLERO SEGÚN ROL
  createForBoardMember(user: JwtAuthUser, roleOnBoard: BoardRole): AppAbility {
    const abilityBuilder = new AbilityBuilder<AppAbility>(createMongoAbility);

    const isApplicationAdmin = user.role === 'admin'; // Si el usuario es admin a nivel de aplicación, le damos permiso total
    if (isApplicationAdmin) {
      abilityBuilder.can(Action.Manage, 'all');
      return abilityBuilder.build({
        detectSubjectType: detectSubjectTypeForAbility,
      });
    }

    abilityBuilder.can(Action.Read, Board);
    abilityBuilder.can(Action.Read, Task);

    const isViewerOnly = roleOnBoard === BoardRole.VIEWER; // Si el rol en el tablero es solo viewer, no le damos permisos de edición
    if (isViewerOnly) {
      return abilityBuilder.build({
        detectSubjectType: detectSubjectTypeForAbility,
      });
    }

    // DAMOS PERMISOS PARA EDITAR
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

    // DAMOS PERMISOS DE ADMINISTRACIÓN DE TABLERO SOLO A ADMIN Y OWNER
    const isBoardAdminOrOwner =
      roleOnBoard === BoardRole.ADMIN || roleOnBoard === BoardRole.OWNER;

    if (isBoardAdminOrOwner) {
      abilityBuilder.can(Action.Update, BoardSubject.Settings);
      abilityBuilder.can(Action.Update, BoardSubject.Members);
    }

    const isBoardOwner = roleOnBoard === BoardRole.OWNER;
    if (isBoardOwner) {
      abilityBuilder.can(Action.Delete, Board);
    }

    return abilityBuilder.build({
      detectSubjectType: detectSubjectTypeForAbility,
    });
  }
}
