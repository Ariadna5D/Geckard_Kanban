import type { AppAbility } from './casl-ability.factory';
import { BoardSubject } from './casl-ability.factory';
import { Action } from './enums/action.enum';
import { User } from '../users/schemas/user.schema';
import { Board } from '../boards/schemas/board.schema';
import { Task } from '../tasks/schemas/task.schema';

/**
 * Agrupa validaciones comunes de permisos
 */
export function canManageUsers(ability: AppAbility): boolean {
  return ability.can(Action.Manage, User);
}

/**
 * Permite crear tableros nuevos
 */
export function canCreateBoard(ability: AppAbility): boolean {
  return ability.can(Action.Create, Board);
}

/**
 * Permite leer tableros visibles
 */
export function canReadBoard(ability: AppAbility): boolean {
  return ability.can(Action.Read, Board);
}

/**
 * Permite editar ajustes del tablero
 */
export function canUpdateBoardSettings(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Settings);
}

/**
 * Permite borrar tablero
 */
export function canDeleteBoard(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Board);
}

/**
 * Permite gestionar miembros del tablero
 */
export function canManageBoardMembers(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Members);
}

/**
 * Permite editar columnas y flujo del tablero
 */
export function canEditBoardColumns(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Columns);
}

/**
 * Permite crear tareas
 */
export function canCreateTask(ability: AppAbility): boolean {
  return ability.can(Action.Create, Task);
}

/**
 * Permite leer tareas
 */
export function canReadTask(ability: AppAbility): boolean {
  return ability.can(Action.Read, Task);
}

/**
 * Permite actualizar tareas
 */
export function canUpdateTask(ability: AppAbility): boolean {
  return ability.can(Action.Update, Task);
}

/**
 * Permite borrar tareas
 */
export function canDeleteTask(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Task);
}
