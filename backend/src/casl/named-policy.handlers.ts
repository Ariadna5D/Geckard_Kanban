import type { AppAbility } from './casl-ability.factory';
import { BoardSubject } from './casl-ability.factory';
import { Action } from './enums/action.enum';
import { User } from '../users/schemas/user.schema';
import { Board } from '../boards/schemas/board.schema';
import { Task } from '../tasks/schemas/task.schema';

/** App-wide admin: manage any user record. */
export function canManageUsers(ability: AppAbility): boolean {
  return ability.can(Action.Manage, User);
}

/** Create a new board (global route, before board context). */
export function canCreateBoard(ability: AppAbility): boolean {
  return ability.can(Action.Create, Board);
}

/** List boards or open a board the user belongs to. */
export function canReadBoard(ability: AppAbility): boolean {
  return ability.can(Action.Read, Board);
}

/** Edit board title / description etc. */
export function canUpdateBoardSettings(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Settings);
}

/** Delete the whole board. */
export function canDeleteBoard(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Board);
}

/** Invite, change role, or remove members. */
export function canManageBoardMembers(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Members);
}

/** Add, rename, reorder, or delete columns. */
export function canEditBoardColumns(ability: AppAbility): boolean {
  return ability.can(Action.Update, BoardSubject.Columns);
}

/** Create a task in a column. */
export function canCreateTask(ability: AppAbility): boolean {
  return ability.can(Action.Create, Task);
}

/** List tasks or read task-related data (e.g. story point votes). */
export function canReadTask(ability: AppAbility): boolean {
  return ability.can(Action.Read, Task);
}

/** Update task fields or move task (DnD). */
export function canUpdateTask(ability: AppAbility): boolean {
  return ability.can(Action.Update, Task);
}

/** Delete a task. */
export function canDeleteTask(ability: AppAbility): boolean {
  return ability.can(Action.Delete, Task);
}
