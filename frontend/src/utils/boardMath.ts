import { generateKeyBetween } from 'fractional-indexing';

/**
 * Calculates the exact string index between two existing indexes.
 * Pass null if there is no previous or next task.
 */
export const calculateNewOrder = (
  prevOrder: string | null,
  nextOrder: string | null
): string => {
  try {
    return generateKeyBetween(prevOrder, nextOrder);
  } catch (error) {
    console.error("Error calculating fractional index:", error);
    // Fallback de seguridad
    return generateKeyBetween(null, null); 
  }
};