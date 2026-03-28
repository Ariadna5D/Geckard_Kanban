import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { User } from '../users/schemas/user.schema';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

type Subjects = InferSubjects<typeof User> | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

// Definimos la estructura exacta del usuario que llega desde tu JWT
export interface JwtUserPayload {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class CaslAbilityFactory {
  // Le decimos que el usuario que recibe es el del JWT
  createForUser(user: JwtUserPayload) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === 'admin') {
      can(Action.Manage, 'all');
    } else {
      can(Action.Read, User);

      // 1. Usamos user.userId, que es el ID real que viaja en tu token
      // 2. Le ponemos "as any" a la regla para que TS no bloquee la build
      can(Action.Update, User, { _id: user.userId } as any);
      can(Action.Delete, User, { _id: user.userId } as any);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
