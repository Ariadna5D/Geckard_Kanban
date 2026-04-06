import { closestCorners, type CollisionDetection } from '@dnd-kit/core';
import type { Board, Column, Task } from '../types/board.types';

/**
 * Al arrastrar columnas, ignoramos las zonas de tarea para que el “over” sea una columna.
 */
export function createBoardCollisionDetection(
  board: Board | null | undefined,
): CollisionDetection {
  return (args) => {
    const draggingColumn = args.active.data.current?.type === 'Column';
    if (draggingColumn && board) {
      const columnIdSet = new Set(board.columns.map((col) => col._id));
      const onlyColumns = args.droppableContainers.filter((container) =>
        columnIdSet.has(String(container.id)),
      );
      if (onlyColumns.length > 0) {
        return closestCorners({ ...args, droppableContainers: onlyColumns });
      }
    }
    return closestCorners(args);
  };
}

export type ColumnDropPayload = { type: 'Column'; column: Column };
export type TaskDropPayload = { type: 'Task'; task: Task };

/**
 * Obtiene el id de columna destino según si soltamos sobre una columna o sobre otra tarea.
 */
export function destinationColumnIdFromDroppable(
  overData: ColumnDropPayload | TaskDropPayload | undefined | null,
): string | undefined {
  if (!overData) return undefined;
  if (overData.type === 'Column') return overData.column._id;
  return overData.task.columnId;
}
