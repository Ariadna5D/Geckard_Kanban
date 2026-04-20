import type {
  Board,
  Task,
  TaskLabelColor,
  TaskPriority,
} from '@/types/board.types';
import { compareOrderKey } from '@/utils/boardMath';

/** Qué subconjunto de tareas mostrar (solo afecta a la vista; el store no cambia). */
export type BoardTaskFilter =
  | { kind: 'all' }
  | { kind: 'priority'; value: TaskPriority }
  | { kind: 'unassigned' }
  /** Tareas con fecha límite en los próximos `days` días (incluye hoy). */
  | { kind: 'due_within_days'; days: number }
  | { kind: 'overdue' }
  | { kind: 'title'; query: string }
  /**
   * Etiquetas seleccionadas: la tarea pasa el filtro si tiene **al menos una**
   * de esas etiquetas (OR). Los nombres se comparan sin distinguir mayúsculas.
   */
  | { kind: 'tags'; names: string[] };

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
      return tasks.filter((task) => task.priority === filter.value);
    case 'unassigned':
      return tasks.filter((task) => !task.assigneeIds?.length);
    case 'due_within_days': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(end.getDate() + filter.days);
      end.setHours(23, 59, 59, 999);
      return tasks.filter((task) => {
        if (!task.dueDate) return false;
        const dueInstant = new Date(task.dueDate);
        return dueInstant >= start && dueInstant <= end;
      });
    }
    case 'overdue': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tasks.filter((task) => {
        if (!task.dueDate) return false;
        return new Date(task.dueDate) < today;
      });
    }
    case 'title':
      return filterTasksByTitleQuery(tasks, filter.query);
    case 'tags': {
      if (filter.names.length === 0) {
        return tasks.slice();
      }
      const wanted = new Set(
        filter.names.map((n) => n.trim().toLowerCase()).filter(Boolean),
      );
      return tasks.filter((task) => {
        const labels = task.labels ?? [];
        return labels.some((lab) =>
          wanted.has(lab.name.trim().toLowerCase()),
        );
      });
    }
    default:
      return tasks.slice();
  }
}

/** Etiquetas únicas usadas en alguna tarea del tablero (para el menú de filtro). */
export function collectTaskLabelOptionsFromBoard(
  board: Board | null,
): { name: string; color: TaskLabelColor }[] {
  if (!board) return [];
  const byLower = new Map<string, { name: string; color: TaskLabelColor }>();
  for (let c = 0; c < board.columns.length; c++) {
    const tasks = board.columns[c].tasks ?? [];
    for (let t = 0; t < tasks.length; t++) {
      const labels = tasks[t].labels ?? [];
      for (let L = 0; L < labels.length; L++) {
        const raw = labels[L].name.trim();
        if (raw === '') continue;
        const low = raw.toLowerCase();
        if (!byLower.has(low)) {
          byLower.set(low, { name: raw, color: labels[L].color });
        }
      }
    }
  }
  return [...byLower.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
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
  list.sort((firstTask, secondTask) => {
    let cmp = 0;
    if (sortKey === 'title') {
      cmp = firstTask.title.localeCompare(secondTask.title, 'es', {
        sensitivity: 'base',
      });
    } else if (sortKey === 'priority') {
      const rankFirst = PRIORITY_RANK[firstTask.priority] ?? 0;
      const rankSecond = PRIORITY_RANK[secondTask.priority] ?? 0;
      cmp = rankFirst - rankSecond;
    } else if (sortKey === 'dueDate') {
      const dueMsFirst = firstTask.dueDate
        ? new Date(firstTask.dueDate).getTime()
        : NaN;
      const dueMsSecond = secondTask.dueDate
        ? new Date(secondTask.dueDate).getTime()
        : NaN;
      if (Number.isNaN(dueMsFirst) && Number.isNaN(dueMsSecond)) cmp = 0;
      else if (Number.isNaN(dueMsFirst)) cmp = 1;
      else if (Number.isNaN(dueMsSecond)) cmp = -1;
      else cmp = dueMsFirst - dueMsSecond;
    }
    if (cmp !== 0) {
      return mult * cmp;
    }
    return compareOrderKey(firstTask.order, secondTask.order);
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
  if (filter.kind === 'tags' && filter.names.length === 0) return false;
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
  if (filter.kind === 'tags' && filter.names.length === 0) {
    return false;
  }
  return true;
}
