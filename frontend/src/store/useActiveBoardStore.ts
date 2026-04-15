import { create } from 'zustand';
import {
  Board,
  Column,
  UpdateTaskPositionPayload,
  Task,
  InviteBoardMemberPayload,
  BoardMemberSummary,
  getBoardDocumentId,
} from '../types/board.types';
import {
  addColumnRequest,
  getBoardBySlugRequest,
  updateColumnRequest,
  deleteColumnRequest,
  updateColumnPositionRequest,
  inviteBoardMemberRequest,
  removeBoardMemberRequest,
  getBoardMembersRequest,
} from '../api/boards.api';
import {
  updateTaskPosition,
  createTaskRequest,
  deleteTaskRequest,
  updateTaskRequest,
} from '../api/tasks.api';
import { compareOrderKey, sortTasksInColumn } from '../utils/boardMath';

function findColumnById(
  columns: Column[],
  columnId: string,
): Column | undefined {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i]._id === columnId) {
      return columns[i];
    }
  }
  return undefined;
}

function findTaskIndex(tasks: Task[], taskId: string): number {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i]._id === taskId) {
      return i;
    }
  }
  return -1;
}

function tasksWithoutTaskId(tasks: Task[], taskId: string): Task[] {
  const out: Task[] = [];
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i]._id !== taskId) {
      out.push(tasks[i]);
    }
  }
  return out;
}

function findColumnIndex(columns: Column[], columnId: string): number {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i]._id === columnId) {
      return i;
    }
  }
  return -1;
}

function mergeServerColumnsWithLocalTasks(
  previousColumns: Column[],
  serverColumns: Column[],
): Column[] {
  const merged: Column[] = [];
  for (let i = 0; i < serverColumns.length; i++) {
    const serverCol = serverColumns[i];
    let tasks: Task[] = [];
    for (let j = 0; j < previousColumns.length; j++) {
      if (previousColumns[j]._id === serverCol._id) {
        const local = previousColumns[j];
        if (local.tasks && local.tasks.length > 0) {
          tasks = local.tasks;
        }
        break;
      }
    }
    merged.push({ ...serverCol, tasks });
  }
  merged.sort(function (a, b) {
    return compareOrderKey(a.order, b.order);
  });
  const out: Column[] = [];
  for (let i = 0; i < merged.length; i++) {
    const col = merged[i];
    out.push({
      ...col,
      tasks: sortTasksInColumn(col.tasks),
    });
  }
  return out;
}

export interface ActiveBoardState {
  board: Board | null;
  boardMembers: BoardMemberSummary[];
  isLoading: boolean;
  error: string | null;

  fetchBoard: (slug: string, opts?: { silent?: boolean }) => Promise<void>;
  inviteMember: (
    slug: string,
    boardId: string,
    payload: InviteBoardMemberPayload,
  ) => Promise<void>;
  removeBoardMember: (
    slug: string,
    boardId: string,
    memberUserId: string,
  ) => Promise<void>;
  moveTaskOptimistic: (
    taskId: string,
    oldColumnId: string,
    newColumnId: string,
    newOrder: string,
    apiPayload: UpdateTaskPositionPayload
  ) => Promise<void>;
  
  // --- CRUD de columnas ---
  addColumn: (boardId: string, title: string, order: string) => Promise<void>;
  editColumn: (boardId: string, columnId: string, title: string) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  moveColumnOptimistic: (boardId: string, columnId: string, newOrder: string) => Promise<void>;
  
  // --- CRUD de tareas ---
  addTask: (
    boardId: string,
    columnId: string,
    title: string,
    order: string,
  ) => Promise<void>;
  deleteTask: (taskId: string, columnId: string) => Promise<void>;
  updateTask: (taskId: string, columnId: string, data: Partial<Task>) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  boardMembers: [],
  isLoading: false,
  error: null,

  // Carga tablero; silent = sin poner isLoading (refrescos)
  fetchBoard: async (slug: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      set({ isLoading: true, error: null, boardMembers: [] });
    }
    try {
      const board = await getBoardBySlugRequest(slug);

      const cols = board.columns.slice();
      cols.sort(function (a, b) {
        return compareOrderKey(a.order, b.order);
      });
      const sortedColumns: typeof board.columns = [];
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        sortedColumns.push({
          ...col,
          tasks: sortTasksInColumn(col.tasks),
        });
      }

      const boardPayload = {
        ...board,
        columns: sortedColumns,
      };
      const boardDocId = getBoardDocumentId(boardPayload);

      set({
        board: boardPayload,
        isLoading: false,
        error: null,
      });

      if (boardDocId) {
        try {
          const { members } = await getBoardMembersRequest(boardDocId);
          set({ boardMembers: members });
        } catch {
          set({ boardMembers: [] });
        }
      } else {
        set({ boardMembers: [] });
      }
    } catch {
      if (!silent) {
        set({
          error: 'Error al cargar el tablero.',
          isLoading: false,
          board: null,
          boardMembers: [],
        });
      } else {
        set({ isLoading: false });
      }
    }
  },

  inviteMember: async (slug, boardId, payload) => {
    await inviteBoardMemberRequest(boardId, payload);
    await get().fetchBoard(slug, { silent: true });
  },

  removeBoardMember: async (slug, boardId, memberUserId) => {
    await removeBoardMemberRequest(boardId, memberUserId);
    await get().fetchBoard(slug, { silent: true });
  },

  /**
   * UI optimista al mover una tarea: actualiza primero la UI y luego sincroniza API.
   * Si falla, hace rollback al estado anterior.
   */
  moveTaskOptimistic: async (taskId, oldColumnId, newColumnId, newOrder, apiPayload) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

    const newBoard: Board = JSON.parse(JSON.stringify(previousBoard));
    const sourceCol = findColumnById(newBoard.columns, oldColumnId);
    const destCol = findColumnById(newBoard.columns, newColumnId);

    if (!sourceCol || !destCol) return;

    const taskIndex = findTaskIndex(sourceCol.tasks!, taskId);
    if (taskIndex === -1) return;
    
    const [taskToMove] = sourceCol.tasks!.splice(taskIndex, 1);

    taskToMove.columnId = newColumnId;
    taskToMove.order = newOrder;
    destCol.tasks!.push(taskToMove);
    destCol.tasks = sortTasksInColumn(destCol.tasks);

    set({ board: newBoard });

    try {
      await updateTaskPosition(taskId, apiPayload);
    } catch (error) {
      console.error("Error al mover la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  /**
   * UI optimista para mover columnas con rollback si la API falla.
   */
  moveColumnOptimistic: async (boardId, columnId, newOrder) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

    // Clonamos estado para aplicar el cambio al instante sin esperar al backend.
    const newBoard: Board = JSON.parse(JSON.stringify(previousBoard));
    const colIndex = findColumnIndex(newBoard.columns, columnId);

    if (colIndex !== -1) {
      newBoard.columns[colIndex].order = newOrder;
      newBoard.columns.sort(function (a, b) {
        return compareOrderKey(a.order, b.order);
      });
    }

    set({ board: newBoard });

    try {
      await updateColumnPositionRequest(boardId, columnId, newOrder);
    } catch (error) {
      console.error("Error al mover la columna, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  /**
   * Añade una nueva columna al tablero al final de la lista.
   */
  addColumn: async (boardId: string, title: string, order: string) => {
    try {
      const updatedBoard = await addColumnRequest(boardId, title, order);
      
      set(function mergeAddColumn(state) {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return {
          board: {
            ...updatedBoard,
            columns: mergedColumns,
          },
        };
      });
    } catch (error) {
      console.error("Error al crear la columna:", error);
    }
  },

  /**
   * Cambia el título de la columna manteniendo las tareas intactas en la UI.
   */
  editColumn: async (boardId, columnId, title) => {
    try {
      const updatedBoard = await updateColumnRequest(boardId, columnId, title);
      
      set(function mergeEditColumn(state) {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return {
          board: {
            ...updatedBoard,
            columns: mergedColumns,
          },
        };
      });
    } catch (error) {
      console.error("Error al editar la columna:", error);
    }
  },

  /**
   * Borra la columna y desaparece de la UI automáticamente junto con sus tareas.
   */
  deleteColumn: async (boardId, columnId) => {
    try {
      const updatedBoard = await deleteColumnRequest(boardId, columnId);
      
      set(function mergeDeleteColumn(state) {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return {
          board: {
            ...updatedBoard,
            columns: mergedColumns,
          },
        };
      });
    } catch (error) {
      console.error("Error al borrar la columna:", error);
    }
  },

  /**
   * Crea una tarea y la inserta en estado local al recibir _id real del backend.
   */
  addTask: async (boardId, columnId, title, order) => {
    try {
      const newTask = await createTaskRequest({
        boardId,
        columnId,
        title,
        order,
      });
      
      set(function applyNewTask(state) {
        if (!state.board) return state;

        const newBoard = { ...state.board };
        const column = findColumnById(newBoard.columns, columnId);

        if (column) {
          const withNew: Task[] = [];
          const existing = column.tasks || [];
          for (let i = 0; i < existing.length; i++) {
            withNew.push(existing[i]);
          }
          withNew.push(newTask);
          column.tasks = sortTasksInColumn(withNew);
        }

        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al crear la tarea:", error);
    }
  },

  /**
   * Borra una tarea usando UI Optimista.
   */
  deleteTask: async (taskId, columnId) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

    const newBoard: Board = JSON.parse(JSON.stringify(previousBoard));
    const column = findColumnById(newBoard.columns, columnId);

    if (column && column.tasks) {
      column.tasks = tasksWithoutTaskId(column.tasks, taskId);
    }

    set({ board: newBoard });

    try {
      await deleteTaskRequest(taskId);
    } catch (error) {
      console.error("Error al borrar la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  /**
   * Actualiza campos de una tarea (título, descripción, etiquetas, etc.).
   */
  updateTask: async (taskId, columnId, data) => {
    try {
      const updatedTask = await updateTaskRequest(taskId, data);
      
      set(function applyTaskUpdate(state) {
        if (!state.board) return state;

        const newBoard = { ...state.board };
        const column = findColumnById(newBoard.columns, columnId);

        if (column && column.tasks) {
          const taskIndex = findTaskIndex(column.tasks, taskId);
          if (taskIndex !== -1) {
            const prev = column.tasks[taskIndex];
            const next: Task = { ...prev, ...updatedTask };
            const requestLinks = Array.isArray(data.links) ? data.links : undefined;
            const requestChecklist = Array.isArray(data.checklist)
              ? data.checklist
              : undefined;
            if (!Array.isArray(next.links)) {
              next.links = requestLinks ?? prev.links ?? [];
            }
            if (!Array.isArray(next.checklist)) {
              next.checklist = requestChecklist ?? prev.checklist ?? [];
            }
            column.tasks[taskIndex] = next;
            column.tasks = sortTasksInColumn(column.tasks);
          }
        }

        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al actualizar la tarea:", error);
    }
  },
}));
