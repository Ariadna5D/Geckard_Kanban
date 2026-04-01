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

/** Sub-recursos del tablero para permisos finos (metadata, miembros, columnas). */
export const BoardSubject = {
  Settings: 'BoardSettings',
  Members: 'BoardMembers',
  Columns: 'BoardColumns',
} as const;

export type BoardFineSubject =
  (typeof BoardSubject)[keyof typeof BoardSubject];

type Subjects =
  | InferSubjects<typeof User | typeof Board | typeof Task>
  | BoardFineSubject
  | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

/** `req.user` inyectado por la estrategia JWT */
export type JwtAuthUser = {
  userId: string;
  role: string;
};

@Injectable()
export class CaslAbilityFactory {
  /** Listar / crear tableros (sin contexto de un tablero concreto). */
  createForUser(user: JwtAuthUser) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'admin') {
      can(Action.Manage, 'all');
    } else {
      can(Action.Read, Board);
      can(Action.Create, Board);
      can(Action.Update, Board, { owner: user.userId });
      can(Action.Delete, Board, { owner: user.userId });

      can(Action.Read, Task);
      can(Action.Create, Task);
      can(Action.Update, Task);
      can(Action.Delete, Task);
    }

    return build({
      detectSubjectType: (item) => this.detectSubjectType(item),
    });
  }

  /**
   * Permisos dentro de un tablero según rol de miembro (owner / admin / editor / viewer).
   * No usar para rutas globales de listado.
   */
  createForBoardMember(user: JwtAuthUser, roleOnBoard: BoardRole) {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'admin') {
      can(Action.Manage, 'all');
      return build({
        detectSubjectType: (item) => this.detectSubjectType(item),
      });
    }

    can(Action.Read, Board);
    can(Action.Read, Task);

    if (roleOnBoard === BoardRole.VIEWER) {
      return build({
        detectSubjectType: (item) => this.detectSubjectType(item),
      });
    }

    if (
      roleOnBoard === BoardRole.EDITOR ||
      roleOnBoard === BoardRole.ADMIN ||
      roleOnBoard === BoardRole.OWNER
    ) {
      can(Action.Update, BoardSubject.Columns);
      can(Action.Create, Task);
      can(Action.Update, Task);
      can(Action.Delete, Task);
    }

    if (roleOnBoard === BoardRole.ADMIN || roleOnBoard === BoardRole.OWNER) {
      can(Action.Update, BoardSubject.Settings);
      can(Action.Update, BoardSubject.Members);
    }

    if (roleOnBoard === BoardRole.OWNER) {
      can(Action.Delete, Board);
    }

    return build({
      detectSubjectType: (item) => this.detectSubjectType(item),
    });
  }

  private detectSubjectType(item: unknown): ExtractSubjectType<Subjects> {
    if (item === null || item === undefined) {
      return 'all' as ExtractSubjectType<Subjects>;
    }
    if (typeof item === 'string') {
      return item as ExtractSubjectType<Subjects>;
    }
    if (
      typeof item === 'object' &&
      item !== null &&
      'constructor' in item &&
      (item as { constructor: unknown }).constructor
    ) {
      return (item as { constructor: ExtractSubjectType<Subjects> })
        .constructor as ExtractSubjectType<Subjects>;
    }
    return 'all' as ExtractSubjectType<Subjects>;
  }
}
