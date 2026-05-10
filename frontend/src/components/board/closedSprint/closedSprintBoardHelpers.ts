import type { Board, Task, TaskLabel } from '@/types/board.types';
import { normalizeTaskLabelsInput } from '../taskCard/taskCardHelpers';

// Busca una tarea viva en las columnas del tablero actual
export function findTaskOnBoard(board: Board | null, taskId: string): Task | null {
  if (!board?.columns) {
    return null;
  }

  for (const column of board.columns) {
    const tasks = column.tasks ?? [];
    for (const task of tasks) {
      if (task._id === taskId) {
        return task;
      }
    }
  }

  return null;
}

// Junta etiquetas del tablero para reutilizarlas en modo solo lectura
export function collectBoardLabelSuggestions(board: Board | null): TaskLabel[] {
  if (!board?.columns) {
    return [];
  }
  const suggestionList: TaskLabel[] = [];
  for (const column of board.columns) {
    for (const boardTask of column.tasks ?? []) {
      for (const label of normalizeTaskLabelsInput(boardTask.labels)) {
        const key = label.name.trim().toLowerCase();
        if (!key) {
          continue;
        }
        let alreadyIncluded = false;
        for (let index = 0; index < suggestionList.length; index++) {
          if (suggestionList[index].name.trim().toLowerCase() === key) {
            alreadyIncluded = true;
            break;
          }
        }
        if (!alreadyIncluded) {
          suggestionList.push(label);
        }
      }
    }
  }
  return suggestionList;
}
