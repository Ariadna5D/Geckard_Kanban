import { generateKeyBetween } from 'fractional-indexing';
import type { Task } from '../types/board.types';

// Comprueba si una clave de orden se puede usar con seguridad
function isValidOrderKey(key: string): boolean {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

// Normaliza claves vacias o invalidas antes del calculo
export function normalizeOrderKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  if (isValidOrderKey(key)) return key;
  return null;
}

// Compara dos claves de orden de forma estable
export function compareOrderKey(
  firstKey: string | null | undefined,
  secondKey: string | null | undefined,
): number {
  const normalizedFirstKey = firstKey ?? '';
  const normalizedSecondKey = secondKey ?? '';
  if (normalizedFirstKey === normalizedSecondKey) return 0;
  if (normalizedFirstKey < normalizedSecondKey) return -1;
  return 1;
}

// Genera una clave de orden nueva entre dos vecinos
export function calculateNewOrder(
  prevOrder: string | null | undefined,
  nextOrder: string | null | undefined,
): string {
  let normalizedPrevOrder = normalizeOrderKey(prevOrder);
  let normalizedNextOrder = normalizeOrderKey(nextOrder);

  if (
    normalizedPrevOrder != null &&
    normalizedNextOrder != null &&
    normalizedPrevOrder >= normalizedNextOrder
  ) {
    // Si vienen invertidas o iguales, reacomodamos limites para no romper oreden
    if (normalizedPrevOrder === normalizedNextOrder) {
      try {
        return generateKeyBetween(normalizedPrevOrder, null);
      } catch {
        return generateKeyBetween(null, null);
      }
    }
    let lowerOrderBoundary = normalizedPrevOrder;
    let upperOrderBoundary = normalizedNextOrder;
    if (normalizedPrevOrder > normalizedNextOrder) {
      lowerOrderBoundary = normalizedNextOrder;
      upperOrderBoundary = normalizedPrevOrder;
    }
    normalizedPrevOrder = lowerOrderBoundary;
    normalizedNextOrder = upperOrderBoundary;
  }

  try {
    return generateKeyBetween(normalizedPrevOrder, normalizedNextOrder);
  } catch {
    return generateKeyBetween(null, null);
  }
}

// Devuelve una copia de tareas ordenadas por su clave
export function sortTasksInColumn(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) return [];
  const tasksCopy = tasks.slice();
  tasksCopy.sort(function (firstTask, secondTask) {
    return compareOrderKey(firstTask.order, secondTask.order);
  });
  return tasksCopy;
}
