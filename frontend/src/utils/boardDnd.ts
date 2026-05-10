import { closestCorners, type CollisionDetection } from '@dnd-kit/core';
import type { Board, Column, Task } from '../types/board.types';
import { calculateNewOrder, compareOrderKey } from './boardMath';

// Calcula colisiones de arrastre segun el tipo de elemento
export function createBoardCollisionDetection(
  board: Board | null | undefined,
): CollisionDetection {
  return function boardCollisionDetection(args) {
    const draggingColumn = args.active.data.current?.type === 'Column';
    if (draggingColumn && board) {
      // Si arrastras columna, solo colisiona contra otras columnas
      const columnIdSet = new Set<string>();
      for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
        columnIdSet.add(board.columns[columnIndex]._id);
      }
      const onlyColumns = [];
      const containers = args.droppableContainers;
      for (let containerIndex = 0; containerIndex < containers.length; containerIndex++) {
        const container = containers[containerIndex];
        if (columnIdSet.has(String(container.id))) {
          onlyColumns.push(container);
        }
      }
      if (onlyColumns.length > 0) {
        return closestCorners({ ...args, droppableContainers: onlyColumns });
      }
    }
    return closestCorners(args);
  };
}

export type ColumnDropPayload = { type: 'Column'; column: Column };
export type TaskDropPayload = { type: 'Task'; task: Task };

// Devuelve la columna destino segun el contenedor de suelta
export function destinationColumnIdFromDroppable(
  overData: ColumnDropPayload | TaskDropPayload | undefined | null,
): string | undefined {
  if (!overData) return undefined;
  if (overData.type === 'Column') return overData.column._id;
  return overData.task.columnId;
}

// Ordena tareas por clave de orden sin mutar el original
function sortTasksByOrderKey(tasks: Task[]): Task[] {
  const copy = tasks.slice();
  copy.sort(function (a, b) {
    return compareOrderKey(a.order, b.order);
  });
  return copy;
}

// Calcula el nuevo orden al soltar una tarea en destino
export function computeTaskDropOrder(
  board: Board,
  args: {
    activeTask: Task;
    activeId: string;
    destColumnId: string;
    overId: string;
    overData: ColumnDropPayload | TaskDropPayload | undefined;
    isBelowOver: boolean;
  },
): string | null {
  let destCol: (typeof board.columns)[0] | undefined;
  for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
    if (board.columns[columnIndex]._id === args.destColumnId) {
      destCol = board.columns[columnIndex];
      break;
    }
  }
  if (!destCol) return null;

  const fullTasks = destCol.tasks || [];
  // Ordenamos antes para insertar en posicion coherente
  const scopedSorted = sortTasksByOrderKey(fullTasks);

  const withoutActive: Task[] = [];
  for (let taskIndex = 0; taskIndex < scopedSorted.length; taskIndex++) {
    if (scopedSorted[taskIndex]._id !== args.activeId) {
      withoutActive.push(scopedSorted[taskIndex]);
    }
  }

  let insertIndex: number;

  if (args.overData && args.overData.type === 'Task') {
    let overIndex = -1;
    for (let taskIndex = 0; taskIndex < withoutActive.length; taskIndex++) {
      if (withoutActive[taskIndex]._id === args.overId) {
        overIndex = taskIndex;
        break;
      }
    }
    if (overIndex === -1) return null;
    insertIndex = args.isBelowOver ? overIndex + 1 : overIndex;
  } else if (
    args.overData &&
    args.overData.type === 'Column' &&
    args.overData.column._id === args.destColumnId
  ) {
    insertIndex = withoutActive.length;
  } else {
    let overIndex = -1;
    for (let taskIndex = 0; taskIndex < withoutActive.length; taskIndex++) {
      if (withoutActive[taskIndex]._id === args.overId) {
        overIndex = taskIndex;
        break;
      }
    }
    if (overIndex === -1) return null;
    insertIndex = args.isBelowOver ? overIndex + 1 : overIndex;
  }

  if (insertIndex < 0) insertIndex = 0;
  if (insertIndex > withoutActive.length) insertIndex = withoutActive.length;

  const reordered = withoutActive.slice();
  // Simulamos lista final para calcular prev y next reales
  reordered.splice(insertIndex, 0, args.activeTask);

  let prev: Task | null = null;
  if (insertIndex > 0) {
    prev = reordered[insertIndex - 1];
  }
  let next: Task | null = null;
  if (insertIndex < reordered.length - 1) {
    next = reordered[insertIndex + 1];
  }

  let prevOrder: string | null = null;
  if (prev) prevOrder = prev.order;

  let nextOrder: string | null = null;
  if (next) {
    if (next.order !== prevOrder) {
      nextOrder = next.order;
    }
  }

  return calculateNewOrder(prevOrder, nextOrder);
}
