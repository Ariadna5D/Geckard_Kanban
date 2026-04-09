import { generateKeyBetween } from 'fractional-indexing';
import type { BoardSprint, Task } from '../types/board.types';

function isValidOrderKey(key: string): boolean {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

export function normalizeOrderKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  if (isValidOrderKey(key)) return key;
  return null;
}

export function compareOrderKey(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const sa = a ?? '';
  const sb = b ?? '';
  if (sa === sb) return 0;
  if (sa < sb) return -1;
  return 1;
}

export function calculateNewOrder(
  prevOrder: string | null | undefined,
  nextOrder: string | null | undefined,
): string {
  let a = normalizeOrderKey(prevOrder);
  let b = normalizeOrderKey(nextOrder);

  if (a != null && b != null && a >= b) {
    if (a === b) {
      try {
        return generateKeyBetween(a, null);
      } catch {
        return generateKeyBetween(null, null);
      }
    }
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    a = lo;
    b = hi;
  }

  try {
    return generateKeyBetween(a, b);
  } catch {
    return generateKeyBetween(null, null);
  }
}

/** Posición del sprint en la lista del tablero (backlog = -1). */
function sprintOrderRank(sprintIdStr: string, sprintIdsInOrder: string[]): number {
  if (sprintIdStr === '') return -1;
  for (let i = 0; i < sprintIdsInOrder.length; i++) {
    if (sprintIdsInOrder[i] === sprintIdStr) return i;
  }
  return 10000;
}

/**
 * Orden en columna: primero backlog, luego sprints como en el tablero, luego `order` dentro del grupo.
 */
export function compareTasksInColumn(
  a: Task,
  b: Task,
  sprintIdsInOrder: string[],
): number {
  const sa = a.sprintId && String(a.sprintId).trim() !== '' ? String(a.sprintId).trim() : '';
  const sb = b.sprintId && String(b.sprintId).trim() !== '' ? String(b.sprintId).trim() : '';
  if (sa === sb) {
    return compareOrderKey(a.order, b.order);
  }

  const ra = sprintOrderRank(sa, sprintIdsInOrder);
  const rb = sprintOrderRank(sb, sprintIdsInOrder);
  if (ra !== rb) {
    return ra - rb;
  }
  return sa.localeCompare(sb);
}

export function sortTasksInColumn(
  tasks: Task[] | undefined,
  sprints: BoardSprint[] | undefined,
): Task[] {
  if (!tasks || tasks.length === 0) return [];

  const list = tasks.slice();
  const sprintIds: string[] = [];
  const s = sprints ?? [];
  for (let i = 0; i < s.length; i++) {
    sprintIds.push(s[i]._id);
  }

  list.sort(function (a, b) {
    return compareTasksInColumn(a, b, sprintIds);
  });
  return list;
}
