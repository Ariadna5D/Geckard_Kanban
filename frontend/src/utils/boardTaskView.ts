import type {
  Board,
  Task,
  TaskLabelColor,
  TaskPriority,
} from '@/types/board.types';
import { compareOrderKey } from '@/utils/boardMath';

// Define los filtros de tareas disponibles en el tablero
export type BoardTaskFilter =
  | { kind: 'all' }
  | { kind: 'priority'; value: TaskPriority }
  | { kind: 'unassigned' }
  | { kind: 'due_within_days'; days: number }
  | { kind: 'overdue' }
  | { kind: 'title'; query: string }
  | { kind: 'tags'; names: string[] };

// Define los tipos de orden disponibles para la vista
export type BoardTaskSortKey = 'manual' | 'title' | 'priority' | 'dueDate';

export type BoardSortDirection = 'asc' | 'desc';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

// Filtra tareas por texto contenido en el titulo
export function filterTasksByTitleQuery(tasks: Task[], query: string): Task[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') {
    return tasks.slice();
  }
  return tasks.filter((task) =>
    task.title.toLowerCase().includes(normalized),
  );
}

// Aplica el filtro activo a una lista de tareas
export function applyBoardTaskFilter(
  tasks: Task[],
  filter: BoardTaskFilter,
): Task[] {
  // Selector central de filtros segun opcion activa en toolbar
  switch (filter.kind) {
    case 'all':
      return tasks.slice();
    case 'priority':
      return tasks.filter((task) => task.priority === filter.value);
    case 'unassigned':
      return tasks.filter((task) => !task.assigneeIds?.length);
    case 'due_within_days': {
      // Tareas que vencen entre hoy y el limite de dias elegido
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
      // Conjunto de etiquetas buscadas para comparar rapido
      const wanted = new Set(
        filter.names.map((labelName) => labelName.trim().toLowerCase()).filter(Boolean),
      );
      return tasks.filter((task) => {
        const labels = task.labels ?? [];
        return labels.some((taskLabel) =>
          wanted.has(taskLabel.name.trim().toLowerCase()),
        );
      });
    }
    default:
      return tasks.slice();
  }
}

// Reune etiquetas unicas presentes en el tablero
export function collectTaskLabelOptionsFromBoard(
  board: Board | null,
): { name: string; color: TaskLabelColor }[] {
  if (!board) return [];
  const byLower = new Map<string, { name: string; color: TaskLabelColor }>();
  for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
    const tasks = board.columns[columnIndex].tasks ?? [];
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      const labels = tasks[taskIndex].labels ?? [];
      for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
        const raw = labels[labelIndex].name.trim();
        if (raw === '') continue;
        const low = raw.toLowerCase();
        if (!byLower.has(low)) {
          byLower.set(low, { name: raw, color: labels[labelIndex].color });
        }
      }
    }
  }
  return [...byLower.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
}

// Ordena tareas segun criterio y direccion de vista
export function sortTasksForBoardView(
  tasks: Task[],
  sortKey: BoardTaskSortKey,
  direction: BoardSortDirection,
): Task[] {
  if (sortKey === 'manual') {
    return tasks.slice();
  }
  // Mult aplica direccion asc o desc sin duplicar comparadores
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

// Indica si hay un filtro visible activo
export function isBoardFilterActive(filter: BoardTaskFilter): boolean {
  if (filter.kind === 'all') return false;
  if (filter.kind === 'title' && filter.query.trim() === '') return false;
  if (filter.kind === 'tags' && filter.names.length === 0) return false;
  return true;
}

export function isBoardSortActive(sortKey: BoardTaskSortKey): boolean {
  return sortKey !== 'manual';
}

// Indica si el arrastre debe bloquearse por tipo de orden
export function shouldLockTaskDrag(sortKey: BoardTaskSortKey): boolean {
  return sortKey !== 'manual';
}
