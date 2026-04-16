import { closestCorners, type CollisionDetection } from '@dnd-kit/core';
import type { Board, Column, Task } from '../types/board.types';
import { calculateNewOrder, compareOrderKey } from './boardMath';

/**
 * Collision detection adaptado al tablero:
 * - si arrastras una columna, solo colisiona contra columnas
 * - si arrastras una tarea, usa la detección estándar de dnd-kit
 */
export function createBoardCollisionDetection(
  board: Board | null | undefined,
): CollisionDetection {
  return function boardCollisionDetection(args) {
    const draggingColumn = args.active.data.current?.type === 'Column';
    if (draggingColumn && board) {
      // Mapa rápido de IDs de columna para filtrar droppables válidos.
      const columnIdSet = new Set<string>();
      for (let i = 0; i < board.columns.length; i++) {
        columnIdSet.add(board.columns[i]._id);
      }
      const onlyColumns = [];
      const containers = args.droppableContainers;
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
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

/** Devuelve la columna de destino según el droppable sobre el que se suelta. */
export function destinationColumnIdFromDroppable(
  overData: ColumnDropPayload | TaskDropPayload | undefined | null,
): string | undefined {
  if (!overData) return undefined;
  if (overData.type === 'Column') return overData.column._id;
  return overData.task.columnId;
}

/** Ordena por clave `order` sin mutar el array original. */
function sortTasksByOrderKey(tasks: Task[]): Task[] {
  const copy = tasks.slice();
  copy.sort(function (a, b) {
    return compareOrderKey(a.order, b.order);
  });
  return copy;
}

/**
 * Calcula la nueva clave `order` al soltar una tarea en una posición determinada.
 * El cálculo se basa en las tareas vecinas en la posición de destino, sin mutar el estado original.
 * Devuelve `null` si no se puede calcular una clave válida.
 */
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
  for (let i = 0; i < board.columns.length; i++) {
    if (board.columns[i]._id === args.destColumnId) {
      destCol = board.columns[i];
      break;
    }
  }
  if (!destCol) return null;

  // Universo real de tareas en la columna destino (orden canónico por `order`).
  const fullTasks = destCol.tasks || [];
  const scopedSorted = sortTasksByOrderKey(fullTasks);

  // Evitamos autocolisión al reinsertar: quitamos la tarea activa del cálculo.
  const withoutActive: Task[] = [];
  for (let i = 0; i < scopedSorted.length; i++) {
    if (scopedSorted[i]._id !== args.activeId) {
      withoutActive.push(scopedSorted[i]);
    }
  }

  let insertIndex: number;

  if (args.overData && args.overData.type === 'Task') {
    // Soltando sobre otra tarea: inserta arriba o abajo según el puntero.
    let overIndex = -1;
    for (let i = 0; i < withoutActive.length; i++) {
      if (withoutActive[i]._id === args.overId) {
        overIndex = i;
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
    // Soltando sobre la propia columna (zona vacía): mandar al final.
    insertIndex = withoutActive.length;
  } else {
    // Fallback defensivo: tratar el overId como tarea.
    let overIndex = -1;
    for (let i = 0; i < withoutActive.length; i++) {
      if (withoutActive[i]._id === args.overId) {
        overIndex = i;
        break;
      }
    }
    if (overIndex === -1) return null;
    insertIndex = args.isBelowOver ? overIndex + 1 : overIndex;
  }

  if (insertIndex < 0) insertIndex = 0;
  if (insertIndex > withoutActive.length) insertIndex = withoutActive.length;

  // Simulamos lista tras soltar para localizar vecinos reales.
  const reordered = withoutActive.slice();
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

  // Clave fraccional final entre vecino anterior y siguiente.
  return calculateNewOrder(prevOrder, nextOrder);
}
