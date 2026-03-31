import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { User } from '../users/schemas/user.schema';
import { Board } from '../boards/schemas/board.schema'; // Importamos el esquema del Tablero
import { Action } from './enums/action.enum'; // Importamos el enum de acciones
// Definimos qué clases (Sujetos) pueden ser controladas por CASL
type Subjects = InferSubjects<typeof User | typeof Board> | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    if (user.role === 'admin') {
      // El administrador puede hacer TODO en TODO
      can(Action.Manage, 'all');
    } else {
      // Reglas para usuarios normales sobre TABLEROS
      can(Action.Read, Board); // Pueden ver tableros
      can(Action.Create, Board); // Pueden crear tableros

      // REGLA DE ORO: Solo el 'owner' puede editar o borrar su tablero
      // Comparamos el campo 'owner' del documento en Mongo con el 'userId' del JWT
      can(Action.Update, Board, { owner: user.userId } as any);
      can(Action.Delete, Board, { owner: user.userId } as any);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
