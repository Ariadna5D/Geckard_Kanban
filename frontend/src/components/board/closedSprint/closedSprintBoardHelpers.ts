import type { Board, Task, TaskLabel } from '@/types/board.types';
import { normalizeTaskLabelsInput } from '../taskCard/taskCardHelpers';

export function findTaskOnBoard(board: Board | null, taskId: string): Task | null {
  if (!board?.columns) {
    return null;
  }
  for (let colIndex = 0; colIndex < board.columns.length; colIndex++) {
    const tasks = board.columns[colIndex].tasks ?? [];
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      if (tasks[taskIndex]._id === taskId) {
        return tasks[taskIndex];
      }
    }
  }
  return null;
}

export function collectBoardLabelSuggestions(board: Board | null): TaskLabel[] {
  if (!board?.columns) {
    return [];
  }
  const suggestionByKey: Record<string, TaskLabel> = {};
  for (const column of board.columns) {
    for (const boardTask of column.tasks ?? []) {
      for (const label of normalizeTaskLabelsInput(boardTask.labels)) {
        const key = label.name.trim().toLowerCase();
        if (!key || suggestionByKey[key]) {
          continue;
        }
        suggestionByKey[key] = label;
      }
    }
  }
  return Object.values(suggestionByKey);
}
