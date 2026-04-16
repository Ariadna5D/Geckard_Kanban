import { generateKeyBetween } from 'fractional-indexing';
import type { Task } from '../types/board.types';

/** Comprueba si una clave `order` es válida para fractional indexing. */
function isValidOrderKey(key: string): boolean {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

/** Normaliza claves vacías o inválidas a `null` para simplificar cálculos. */
export function normalizeOrderKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  if (isValidOrderKey(key)) return key;
  return null;
}

/** Comparación lexicográfica estable para ordenar por `order`. */
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

/**
 * Genera una nueva clave `order` entre dos vecinos.
 * Si las fronteras llegan desordenadas o iguales, aplica un saneo defensivo.
 */
export function calculateNewOrder(
  prevOrder: string | null | undefined,
  nextOrder: string | null | undefined,
): string {
  let normalizedPrevOrder = normalizeOrderKey(prevOrder);
  let normalizedNextOrder = normalizeOrderKey(nextOrder);

  // Si ambas claves existen pero están desordenadas o son iguales, las saneamos para evitar errores en el cálculo.
  if (
    normalizedPrevOrder != null &&
    normalizedNextOrder != null &&
    normalizedPrevOrder >= normalizedNextOrder
  ) {
    if (normalizedPrevOrder === normalizedNextOrder) {
      // Caso raro de claves idénticas: generar nueva clave entre la clave y `null` (final).
      try {
        return generateKeyBetween(normalizedPrevOrder, null);
      } catch {
        return generateKeyBetween(null, null);
      }
    }
    // Caso de claves desordenadas: reordenar las tarjetas para sanear el cálculo.
    const lowerOrderBoundary =
      normalizedPrevOrder < normalizedNextOrder
        ? normalizedPrevOrder
        : normalizedNextOrder;
    const upperOrderBoundary =
      normalizedPrevOrder < normalizedNextOrder
        ? normalizedNextOrder
        : normalizedPrevOrder;
    normalizedPrevOrder = lowerOrderBoundary;
    normalizedNextOrder = upperOrderBoundary;
  }

  try {
    // Camino nominal: generar clave entre vecino anterior y siguiente.
    return generateKeyBetween(normalizedPrevOrder, normalizedNextOrder);
  } catch {
    // Fallback seguro en caso de claves corruptas/no compatibles.
    return generateKeyBetween(null, null);
  }
}

/** Devuelve copia ordenada de tareas por su `order` (no muta el array original). */
export function sortTasksInColumn(tasks: Task[] | undefined): Task[] {
  if (!tasks || tasks.length === 0) return [];
  const tasksCopy = tasks.slice();
  tasksCopy.sort(function (firstTask, secondTask) {
    return compareOrderKey(firstTask.order, secondTask.order);
  });
  return tasksCopy;
}
