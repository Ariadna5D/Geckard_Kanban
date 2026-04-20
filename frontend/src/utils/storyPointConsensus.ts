/**
 * Valores permitidos al votar story points (Fibonacci corto).
 */
export const STORY_POINT_VOTE_SCALE = [1, 2, 3, 5, 8, 13] as const;

/**
 * Media de los votos y el Fibonacci más cercano (para mostrar sugerencia en UI).
 */
export function consensusFromVoteValues(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
    sum += values[valueIndex];
  }
  const mean = sum / values.length;

  let best = STORY_POINT_VOTE_SCALE[0];
  let bestDist = Math.abs(mean - best);
  for (const f of STORY_POINT_VOTE_SCALE) {
    const distance = Math.abs(mean - f);
    if (
      distance < bestDist ||
      (distance === bestDist && f < best)
    ) {
      bestDist = distance;
      best = f;
    }
  }
  return best;
}

/**
 * Normaliza votos crudos del backend: solo userId en string y valor en la escala.
 */
export function normalizeStoryPointVotes(
  raw: unknown,
): { userId: string; value: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { userId: string; value: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const userId = parseUserIdFromVote(row.userId);
    const value = typeof row.value === 'number' ? row.value : Number(row.value);
    if (!userId || Number.isNaN(value)) continue;
    let isOnScale = false;
    for (const f of STORY_POINT_VOTE_SCALE) {
      if (f === value) {
        isOnScale = true;
        break;
      }
    }
    if (isOnScale) out.push({ userId, value });
  }
  return out;
}

function parseUserIdFromVote(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    const s = String((value as { toString: () => string }).toString());
    return s === '[object Object]' ? '' : s;
  }
  return '';
}
