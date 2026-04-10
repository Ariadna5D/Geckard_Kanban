import { generateKeyBetween } from 'fractional-indexing';
import type { Task } from '../types/board.types';

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

export function sortTasksInColumn(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) return [];
  const list = tasks.slice();
  list.sort(function (a, b) {
    return compareOrderKey(a.order, b.order);
  });
  return list;
}
