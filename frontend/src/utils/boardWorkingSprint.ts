import type { BoardSprint } from '@/types/board.types';

function storageKey(boardId: string): string {
  return 'kanban:working-sprint:' + boardId;
}

export function getStoredWorkingSprintId(boardId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(boardId));
    if (!raw) return null;
    const v = raw.trim();
    if (v === '') return null;
    return v;
  } catch {
    return null;
  }
}

export function setStoredWorkingSprintId(boardId: string, sprintId: string): void {
  try {
    localStorage.setItem(storageKey(boardId), sprintId);
  } catch {
    // navegador sin storage
  }
}

/** Sprints con estado activo en el tablero. */
export function getActiveSprints(sprints: BoardSprint[]): BoardSprint[] {
  const out: BoardSprint[] = [];
  for (let i = 0; i < sprints.length; i++) {
    if (sprints[i].status === 'active') {
      out.push(sprints[i]);
    }
  }
  return out;
}

function sprintExistsInBoard(sprintId: string, sprints: BoardSprint[]): boolean {
  for (let i = 0; i < sprints.length; i++) {
    if (sprints[i]._id === sprintId) return true;
  }
  return false;
}

function sprintIsActive(sprintId: string, active: BoardSprint[]): boolean {
  for (let i = 0; i < active.length; i++) {
    if (active[i]._id === sprintId) return true;
  }
  return false;
}

/**
 * Filtro inicial al abrir el tablero: preferencia guardada (sprint activo), primer sprint activo,
 * o backlog si no hay ninguno activo (tablero sin sprint en curso o uso solo Kanban/backlog).
 */
export function resolveDefaultSprintFilter(
  boardId: string,
  sprints: BoardSprint[],
): 'all' | 'backlog' | string {
  const active = getActiveSprints(sprints);

  const saved = getStoredWorkingSprintId(boardId);
  if (saved && sprintExistsInBoard(saved, sprints) && sprintIsActive(saved, active)) {
    return saved;
  }

  if (active.length >= 1) {
    return active[0]._id;
  }

  return 'backlog';
}
