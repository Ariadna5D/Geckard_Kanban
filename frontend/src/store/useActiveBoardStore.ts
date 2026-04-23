import { create } from 'zustand';
import {
  Board,
  Column,
  CreateTaskPayload,
  UpdateTaskPositionPayload,
  Task,
  InviteBoardMemberPayload,
  BoardMemberSummary,
  BoardActivityEntry,
  getBoardDocumentId,
} from '../types/board.types';
import {
  addColumnRequest,
  getBoardBySlugRequest,
  updateColumnRequest,
  archiveColumnRequest,
  restoreArchivedColumnRequest,
  deleteColumnRequest,
  updateColumnPositionRequest,
  inviteBoardMemberRequest,
  removeBoardMemberRequest,
  getBoardMembersRequest,
  getBoardActivityRequest,
  createSprintRequest,
  closeSprintRequest,
  updateActiveSprintRequest,
  cancelActiveSprintRequest,
  updateClosedSprintHistoryRequest,
  deleteClosedSprintHistoryRequest,
  type CreateSprintPayload,
  type UpdateActiveSprintPayload,
  type UpdateColumnPayload,
} from '../api/boards.api';
import {
  updateTaskPosition,
  createTaskRequest,
  deleteTaskRequest,
  getArchivedTasksByBoardRequest,
  restoreTaskRequest,
  purgeTaskRequest,
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
  boardActivityLogs: BoardActivityEntry[];
  archivedTasks: Task[];
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
  loadBoardActivity: (boardId: string, limit?: number) => Promise<void>;
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
  /** PATCH column title and/or columnKind (workflow / done / archived). */
  patchColumn: (
    boardId: string,
    columnId: string,
    payload: UpdateColumnPayload,
  ) => Promise<void>;
  archiveColumn: (boardId: string, columnId: string) => Promise<void>;
  restoreArchivedColumn: (boardId: string, columnId: string) => Promise<void>;
  /** Borrado definitivo solo si la columna ya está archivada (admin del tablero). */
  purgeArchivedColumn: (boardId: string, columnId: string) => Promise<void>;
  moveColumnOptimistic: (boardId: string, columnId: string, newOrder: string) => Promise<void>;

  /** Starts the single active sprint (board must have sprints enabled). */
  startBoardSprint: (
    boardId: string,
    payload: CreateSprintPayload,
  ) => Promise<void>;
  /** Closes active sprint, saves snapshot, clears sprint tags on tasks. */
  closeBoardSprint: (boardId: string, sprintId: string) => Promise<void>;
  /** Updates name or planned dates on the active sprint. */
  updateActiveSprintBoard: (
    boardId: string,
    sprintId: string,
    payload: UpdateActiveSprintPayload,
  ) => Promise<void>;
  /** Drops active sprint without history snapshot. */
  cancelActiveSprintBoard: (boardId: string, sprintId: string) => Promise<void>;
  /** Renames a sprint in closed history (board admin). */
  updateClosedSprintHistoryBoard: (
    boardId: string,
    sprintId: string,
    sprintName: string,
  ) => Promise<void>;
  /** Removes one closed sprint from history (board admin). */
  deleteClosedSprintHistoryBoard: (
    boardId: string,
    sprintId: string,
  ) => Promise<void>;

  // --- CRUD de tareas ---
  addTask: (
    boardId: string,
    columnId: string,
    title: string,
    order: string,
    options?: { sprintId?: string },
  ) => Promise<void>;
  archiveTask: (taskId: string, columnId: string) => Promise<void>;
  loadArchivedTasks: (boardId: string) => Promise<void>;
  restoreArchivedTask: (taskId: string) => Promise<void>;
  purgeArchivedTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, columnId: string, data: Partial<Task>) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  boardMembers: [],
  boardActivityLogs: [],
  archivedTasks: [],
  isLoading: false,
  error: null,

  // Carga tablero; silent = sin poner isLoading (refrescos)
  fetchBoard: async (slug: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      set({
        isLoading: true,
        error: null,
        boardMembers: [],
        boardActivityLogs: [],
        archivedTasks: [],
      });
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
        archivedTasks: [],
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
          boardActivityLogs: [],
          archivedTasks: [],
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

  loadBoardActivity: async (boardId, limit = 60) => {
    try {
      const boardActivityLogs = await getBoardActivityRequest(boardId, limit);
      set({ boardActivityLogs });
    } catch (error) {
      console.error('Error al cargar actividad del tablero:', error);
      set({ boardActivityLogs: [] });
      throw error;
    }
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
      const updatedBoard = await updateColumnRequest(boardId, columnId, {
        title,
      });

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

  patchColumn: async (boardId, columnId, payload) => {
    try {
      const updatedBoard = await updateColumnRequest(
        boardId,
        columnId,
        payload,
      );

      set(function mergePatchColumn(state) {
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
      console.error("Error al actualizar la columna:", error);
    }
  },

  startBoardSprint: async (boardId, payload) => {
    try {
      const updatedBoard = await createSprintRequest(boardId, payload);
      set(function mergeAfterStartSprint(state) {
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
      console.error("Error al crear el sprint:", error);
    }
  },

  closeBoardSprint: async (boardId, sprintId) => {
    try {
      const updatedBoard = await closeSprintRequest(boardId, sprintId);
      set(function mergeAfterCloseSprint(state) {
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
      console.error("Error al cerrar el sprint:", error);
      throw error;
    }
  },

  updateActiveSprintBoard: async (boardId, sprintId, payload) => {
    try {
      const updatedBoard = await updateActiveSprintRequest(
        boardId,
        sprintId,
        payload,
      );
      set(function mergeAfterUpdateActiveSprint(state) {
        if (!state.board) return state;
        return {
          board: {
            ...updatedBoard,
            columns: mergeServerColumnsWithLocalTasks(
              state.board.columns,
              updatedBoard.columns,
            ),
          },
        };
      });
    } catch (error) {
      console.error("Error al actualizar el sprint:", error);
    }
  },

  cancelActiveSprintBoard: async (boardId, sprintId) => {
    try {
      const updatedBoard = await cancelActiveSprintRequest(boardId, sprintId);
      set(function mergeAfterCancelSprint(state) {
        if (!state.board) return state;
        return {
          board: {
            ...updatedBoard,
            columns: mergeServerColumnsWithLocalTasks(
              state.board.columns,
              updatedBoard.columns,
            ),
          },
        };
      });
    } catch (error) {
      console.error("Error al cancelar el sprint:", error);
    }
  },

  updateClosedSprintHistoryBoard: async (boardId, sprintId, sprintName) => {
    try {
      const updatedBoard = await updateClosedSprintHistoryRequest(
        boardId,
        sprintId,
        { sprintName },
      );
      set(function mergeAfterRenameClosedSprint(state) {
        if (!state.board) return state;
        return {
          board: {
            ...updatedBoard,
            columns: mergeServerColumnsWithLocalTasks(
              state.board.columns,
              updatedBoard.columns,
            ),
          },
        };
      });
    } catch (error) {
      console.error("Error al renombrar sprint del historial:", error);
    }
  },

  deleteClosedSprintHistoryBoard: async (boardId, sprintId) => {
    try {
      const updatedBoard = await deleteClosedSprintHistoryRequest(
        boardId,
        sprintId,
      );
      set(function mergeAfterDeleteClosedSprint(state) {
        if (!state.board) return state;
        return {
          board: {
            ...updatedBoard,
            columns: mergeServerColumnsWithLocalTasks(
              state.board.columns,
              updatedBoard.columns,
            ),
          },
        };
      });
    } catch (error) {
      console.error("Error al borrar sprint del historial:", error);
    }
  },

  archiveColumn: async (boardId, columnId) => {
    try {
      const updatedBoard = await archiveColumnRequest(boardId, columnId);
      set(function mergeArchiveColumn(state) {
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
      void get().loadArchivedTasks(boardId);
    } catch (error) {
      console.error("Error al archivar la columna:", error);
      throw error;
    }
  },

  restoreArchivedColumn: async (boardId, columnId) => {
    try {
      const updatedBoard = await restoreArchivedColumnRequest(
        boardId,
        columnId,
      );
      set(function mergeRestoreColumn(state) {
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
      void get().loadArchivedTasks(boardId);
    } catch (error) {
      console.error("Error al restaurar la columna:", error);
      throw error;
    }
  },

  purgeArchivedColumn: async (boardId, columnId) => {
    try {
      const updatedBoard = await deleteColumnRequest(boardId, columnId);
      set(function mergePurgeColumn(state) {
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
      void get().loadArchivedTasks(boardId);
    } catch (error) {
      console.error("Error al eliminar la columna:", error);
      throw error;
    }
  },

  /**
   * Crea una tarea y la inserta en estado local al recibir _id real del backend.
   */
  addTask: async (boardId, columnId, title, order, options) => {
    try {
      const createPayload: CreateTaskPayload = {
        boardId,
        columnId,
        title,
        order,
      };
      if (options?.sprintId !== undefined && options.sprintId !== '') {
        createPayload.sprintId = options.sprintId;
      }
      const newTask = await createTaskRequest(createPayload);
      
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
   * Archiva una tarea con UI optimista (desaparece del tablero principal).
   */
  archiveTask: async (taskId, columnId) => {
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
      console.error("Error al archivar la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  /**
   * Carga el listado de tareas archivadas del tablero actual.
   */
  loadArchivedTasks: async (boardId) => {
    try {
      const archivedTasks = await getArchivedTasksByBoardRequest(boardId);
      set({ archivedTasks });
    } catch (error) {
      console.error("Error al cargar archivadas:", error);
      set({ archivedTasks: [] });
      throw error;
    }
  },

  /**
   * Restaura una archivada y refresca tablero + listado de archivadas.
   */
  restoreArchivedTask: async (taskId) => {
    const board = get().board;
    if (!board) return;
    const boardDocId = getBoardDocumentId(board);
    if (!boardDocId) return;
    try {
      await restoreTaskRequest(taskId);
      await get().fetchBoard(board.slug, { silent: true });
      await get().loadArchivedTasks(boardDocId);
    } catch (error) {
      console.error("Error al restaurar tarea archivada:", error);
      throw error;
    }
  },

  /**
   * Purga definitivamente una tarea archivada (admin/owner).
   */
  purgeArchivedTask: async (taskId) => {
    try {
      await purgeTaskRequest(taskId);
      set((state) => ({
        archivedTasks: tasksWithoutTaskId(state.archivedTasks, taskId),
      }));
    } catch (error) {
      console.error("Error al borrar definitivamente archivada:", error);
      throw error;
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
