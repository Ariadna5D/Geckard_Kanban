import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { User } from '../users/schemas/user.schema';
import { Board } from '../boards/schemas/board.schema';
import { Action } from './enums/action.enum';

// 1. IMPORTAMOS EL SCHEMA DE TASK
import { Task } from '../tasks/schemas/task.schema';

// 2. AÑADIMOS typeof Task A LOS SUBJECTS PERMITIDOS
type Subjects = InferSubjects<typeof User | typeof Board | typeof Task> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === 'admin') {
      can(Action.Manage, 'all');
    } else {
      can(Action.Read, Board);
      can(Action.Create, Board);
      can(Action.Update, Board, { owner: user.userId } as any);
      can(Action.Delete, Board, { owner: user.userId } as any);

      can(Action.Read, Task);
      can(Action.Create, Task);
      can(Action.Update, Task);
      can(Action.Delete, Task);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
