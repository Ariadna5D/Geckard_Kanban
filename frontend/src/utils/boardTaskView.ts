import type { Task, TaskPriority } from '@/types/board.types';
import { compareOrderKey } from '@/utils/boardMath';

/** Qué subconjunto de tareas mostrar (solo afecta a la vista; el store no cambia). */
export type BoardTaskFilter =
  | { kind: 'all' }
  | { kind: 'priority'; value: TaskPriority }
  | { kind: 'unassigned' }
  /** Tareas con fecha límite en los próximos `days` días (incluye hoy). */
  | { kind: 'due_within_days'; days: number }
  | { kind: 'overdue' }
  | { kind: 'title'; query: string };

/** Cómo ordenar las tareas dentro de cada columna en pantalla. */
export type BoardTaskSortKey = 'manual' | 'title' | 'priority' | 'dueDate';

export type BoardSortDirection = 'asc' | 'desc';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

/**
 * Filtra por texto en el título (sin distinguir mayúsculas).
 * Consulta vacía → copia del array (mismo orden).
 */
export function filterTasksByTitleQuery(tasks: Task[], query: string): Task[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return tasks.slice();
  }
  return tasks.filter((task) =>
    task.title.toLowerCase().includes(normalized),
  );
}

/** Aplica un criterio de filtro del menú. */
export function applyBoardTaskFilter(
  tasks: Task[],
  filter: BoardTaskFilter,
): Task[] {
  switch (filter.kind) {
    case 'all':
      return tasks.slice();
    case 'priority':
      return tasks.filter((t) => t.priority === filter.value);
    case 'unassigned':
      return tasks.filter((t) => !t.assigneeIds?.length);
    case 'due_within_days': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() + filter.days);
      end.setHours(23, 59, 59, 999);
      return tasks.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= start && d <= end;
      });
    }
    case 'overdue': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tasks.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < today;
      });
    }
    case 'title':
      return filterTasksByTitleQuery(tasks, filter.query);
    default:
      return tasks.slice();
  }
}

/**
 * Orden de vista. `manual` respeta el orden del array (ya viene por `order` del tablero).
 */
export function sortTasksForBoardView(
  tasks: Task[],
  sortKey: BoardTaskSortKey,
  direction: BoardSortDirection,
): Task[] {
  if (sortKey === 'manual') {
    return tasks.slice();
  }
  const mult = direction === 'asc' ? 1 : -1;
  const list = tasks.slice();
  list.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'title') {
      cmp = a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    } else if (sortKey === 'priority') {
      const ra = PRIORITY_RANK[a.priority] ?? 0;
      const rb = PRIORITY_RANK[b.priority] ?? 0;
      cmp = ra - rb;
    } else if (sortKey === 'dueDate') {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
      if (Number.isNaN(da) && Number.isNaN(db)) cmp = 0;
      else if (Number.isNaN(da)) cmp = 1;
      else if (Number.isNaN(db)) cmp = -1;
      else cmp = da - db;
    }
    if (cmp !== 0) {
      return mult * cmp;
    }
    return compareOrderKey(a.order, b.order);
  });
  return list;
}

/**
 * Si es true, no debe permitirse arrastrar tareas: el orden en pantalla no coincide con `order` guardado
 * o hay un filtro que oculta tarjetas.
 */
/** True si el usuario eligió algo distinto de “todas” (o título con texto). */
export function isBoardFilterActive(filter: BoardTaskFilter): boolean {
  if (filter.kind === 'all') return false;
  if (filter.kind === 'title' && filter.query.trim() === '') return false;
  return true;
}

export function isBoardSortActive(sortKey: BoardTaskSortKey): boolean {
  return sortKey !== 'manual';
}

export function shouldLockTaskDrag(
  filter: BoardTaskFilter,
  sortKey: BoardTaskSortKey,
): boolean {
  if (sortKey !== 'manual') {
    return true;
  }
  if (filter.kind === 'all') {
    return false;
  }
  if (filter.kind === 'title' && filter.query.trim() === '') {
    return false;
  }
  return true;
}
