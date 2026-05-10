// Calcula consenso de votos de story points
export const STORY_POINT_VOTE_SCALE = [1, 2, 3, 5, 8, 13] as const;

export function consensusFromVoteValues(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
    sum += values[valueIndex];
  }
  const mean = sum / values.length;

  // Elegimos el valor fibonacci mas cercano al promedio del equipo
  let best = STORY_POINT_VOTE_SCALE[0];
  let bestDist = Math.abs(mean - best);
  for (const scaleValue of STORY_POINT_VOTE_SCALE) {
    const distance = Math.abs(mean - scaleValue);
    if (
      distance < bestDist ||
      (distance === bestDist && scaleValue < best)
    ) {
      bestDist = distance;
      best = scaleValue;
    }
  }
  return best;
}

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
    for (const scaleValue of STORY_POINT_VOTE_SCALE) {
      if (scaleValue === value) {
        isOnScale = true;
        break;
      }
    }
    if (isOnScale) out.push({ userId, value });
  }
  return out;
}

// Intenta sacar userId aunque llegue string u objeto serializable
function parseUserIdFromVote(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    const stringValue = String((value as { toString: () => string }).toString());
    return stringValue === '[object Object]' ? '' : stringValue;
  }
  return '';
}
