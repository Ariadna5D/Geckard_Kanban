import type { AppAbility } from './casl-ability.factory';
import { BoardSubject } from './casl-ability.factory';
import { Action } from './enums/action.enum';
import { User } from '../users/schemas/user.schema';
import { Board } from '../boards/schemas/board.schema';
import { Task } from '../tasks/schemas/task.schema';

// Poder hacer cualquier cosa con usuarios
export function canManageUsers(ability: AppAbility): boolean {
  return ability.can(Action.Manage, User);
}

// TABLERO ////////////////////////////////
export function canCreateBoard(ability: AppAbility): boolean {
  return ability.can(Action.Create, Board);
}

export function canReadBoard(ability: AppAbility): boolean {
  return ability.can(Action.Read, Board);
}

// Solo update de nombre o descripción
export function canUpdateBoardSettings(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Settings);
}

export function canDeleteBoard(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Board);
}

// invitar, eliminar o cambiar rol de miembros del tablero
export function canManageBoardMembers(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Members);
}

// COLUMNAS /////////////////////////////////

// Añadir, renombrar, reordenar o borrar columnas.
export function canEditBoardColumns(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Columns);
}

// TAREAS /////////////////////////////////

export function canCreateTask(ability: AppAbility): boolean {
  return ability.can(Action.Create, Task);
}

export function canReadTask(ability: AppAbility): boolean {
  return ability.can(Action.Read, Task);
}

export function canUpdateTask(ability: AppAbility): boolean {
  return ability.can(Action.Update, Task);
}

export function canDeleteTask(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Task);
}
