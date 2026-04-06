import { generateKeyBetween } from 'fractional-indexing';

/**
 * Comprueba si `key` es válida para fractional-indexing (misma regla que generateKeyBetween).
 * Claves inválidas típicas: "", "a" (sin sufijo), "1" (empieza en dígito), etc.
 */
function isValidOrderKey(key: string): boolean {
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

/** Convierte valores legacy / corruptos en null para que generateKeyBetween pueda rellenar. */
export function normalizeOrderKey(key: string | null | undefined): string | null {
  if (key == null || key === '') return null;
  return isValidOrderKey(key) ? key : null;
}

/**
 * Orden lexicográfico de claves (el que usa la librería en `a >= b`).
 * Sustituye a localeCompare para listas ordenadas por fractional index.
 */
export function compareOrderKey(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const sa = a ?? '';
  const sb = b ?? '';
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

/**
 * Calcula una clave entre dos índices fraccionarios existentes.
 * Pasa null si no hay anterior o siguiente.
 */
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
