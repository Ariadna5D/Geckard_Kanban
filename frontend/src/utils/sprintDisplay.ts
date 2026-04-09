/**
 * Texto legible para el rango de fechas de un sprint (ISO del API).
 * Devuelve null si no hay ninguna fecha.
 */
export function formatSprintDateRange(
  startsAt?: string,
  endsAt?: string,
): string | null {
  if (!startsAt?.trim() && !endsAt?.trim()) return null;

  const fmt = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  function one(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.trim();
    return fmt.format(d);
  }

  const s = startsAt?.trim();
  const e = endsAt?.trim();
  if (s && e) return `${one(s)} – ${one(e)}`;
  if (s) return `Desde ${one(s)}`;
  return `Hasta ${one(e!)}`;
}
