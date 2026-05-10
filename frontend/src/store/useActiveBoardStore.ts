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
  type UpdateTaskRequestBody,
} from '../api/tasks.api';
import { compareOrderKey, sortTasksInColumn } from '../utils/boardMath';

// Une listas enviadas al guardar con lo que vuelve del servidor
function mergePatchListField<Item>(
  previousItems: Item[] | undefined,
  requestedItems: Item[] | undefined,
  serverItems: Item[] | undefined,
): Item[] {
  if (!Array.isArray(requestedItems)) {
    return Array.isArray(serverItems) ? serverItems : previousItems ?? [];
  }
  if (requestedItems.length === 0) {
    return Array.isArray(serverItems) ? serverItems : [];
  }
  if (Array.isArray(serverItems) && serverItems.length > 0) {
    return serverItems;
  }
  return requestedItems;
}

function findColumnById(
  columns: Column[],
  columnId: string,
): Column | undefined {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
    if (columns[columnIndex]._id === columnId) {
      return columns[columnIndex];
    }
  }
  return undefined;
}

function findTaskIndex(tasks: Task[], taskId: string): number {
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    if (tasks[taskIndex]._id === taskId) {
      return taskIndex;
    }
  }
  return -1;
}

function tasksWithoutTaskId(tasks: Task[], taskId: string): Task[] {
  const out: Task[] = [];
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
    if (tasks[taskIndex]._id !== taskId) {
      out.push(tasks[taskIndex]);
    }
  }
  return out;
}

function findColumnIndex(columns: Column[], columnId: string): number {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
    if (columns[columnIndex]._id === columnId) {
      return columnIndex;
    }
  }
  return -1;
}

function mergeServerColumnsWithLocalTasks(
  previousColumns: Column[],
  serverColumns: Column[],
): Column[] {
  function isColumnArchivedOnServer(column: Column): boolean {
    const maybeArchivedAt = (column as unknown as { archivedAt?: unknown }).archivedAt;
    return maybeArchivedAt !== undefined && maybeArchivedAt !== null;
  }

  const activeServerColumns = serverColumns.filter(
    (column) => !isColumnArchivedOnServer(column),
  );

  const merged: Column[] = [];
  // Fusiona metadata de servidor con tareas locales que ya estan en ui
  for (let serverColumnIndex = 0; serverColumnIndex < activeServerColumns.length; serverColumnIndex++) {
    const serverCol = activeServerColumns[serverColumnIndex];
    let tasks: Task[] = [];
    for (let previousColumnIndex = 0; previousColumnIndex < previousColumns.length; previousColumnIndex++) {
      if (previousColumns[previousColumnIndex]._id === serverCol._id) {
        const local = previousColumns[previousColumnIndex];
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
  for (let mergedColumnIndex = 0; mergedColumnIndex < merged.length; mergedColumnIndex++) {
    const col = merged[mergedColumnIndex];
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
  
  // Define operaciones de columnas del tablero
  addColumn: (boardId: string, title: string, order: string) => Promise<void>;
  editColumn: (boardId: string, columnId: string, title: string) => Promise<void>;
  patchColumn: (
    boardId: string,
    columnId: string,
    payload: UpdateColumnPayload,
  ) => Promise<void>;
  archiveColumn: (boardId: string, columnId: string) => Promise<void>;
  restoreArchivedColumn: (boardId: string, columnId: string) => Promise<void>;
  purgeArchivedColumn: (boardId: string, columnId: string) => Promise<void>;
  moveColumnOptimistic: (boardId: string, columnId: string, newOrder: string) => Promise<void>;

  startBoardSprint: (
    boardId: string,
    payload: CreateSprintPayload,
  ) => Promise<void>;
  closeBoardSprint: (boardId: string, sprintId: string) => Promise<void>;
  updateActiveSprintBoard: (
    boardId: string,
    sprintId: string,
    payload: UpdateActiveSprintPayload,
  ) => Promise<void>;
  cancelActiveSprintBoard: (boardId: string, sprintId: string) => Promise<void>;
  updateClosedSprintHistoryBoard: (
    boardId: string,
    sprintId: string,
    sprintName: string,
  ) => Promise<void>;
  deleteClosedSprintHistoryBoard: (
    boardId: string,
    sprintId: string,
  ) => Promise<void>;

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
  updateTask: (
    taskId: string,
    columnId: string,
    taskUpdatePayload: UpdateTaskRequestBody,
  ) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  boardMembers: [],
  boardActivityLogs: [],
  archivedTasks: [],
  isLoading: false,
  error: null,

  // Carga un tablero por slug con opcion de refresco silencioso
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
      // Pide tablero por slug y ordena columnas y tareas para render estable
      const board = await getBoardBySlugRequest(slug);

      const cols = board.columns.slice();
      cols.sort(function (a, b) {
        return compareOrderKey(a.order, b.order);
      });
      const sortedColumns: typeof board.columns = [];
      for (let columnIndex = 0; columnIndex < cols.length; columnIndex++) {
        const col = cols[columnIndex];
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
          // Carga miembros en llamada separada para no bloquear primer render
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
    // Invita usuario y refresca tablero en segundo plano
    await inviteBoardMemberRequest(boardId, payload);
    await get().fetchBoard(slug, { silent: true });
  },

  removeBoardMember: async (slug, boardId, memberUserId) => {
    // Quita miembro y sincroniza cambios de permisos en tablero
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

  // Mueve una tarea con UI optimista y rollback en error
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
      // Confirma movimiento contra backend
      await updateTaskPosition(taskId, apiPayload);
    } catch (error) {
      console.error("Error al mover la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  // Mueve una columna con UI optimista y rollback en error
  moveColumnOptimistic: async (boardId, columnId, newOrder) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

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
      // Confirma reordenacion de columna en backend
      await updateColumnPositionRequest(boardId, columnId, newOrder);
    } catch (error) {
      console.error("Error al mover la columna, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  // Agrega una columna nueva y sincroniza su estado
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

  // Edita una columna conservando tareas locales
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

  // Crea una tarea y la inserta en estado local
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
          for (let existingTaskIndex = 0; existingTaskIndex < existing.length; existingTaskIndex++) {
            withNew.push(existing[existingTaskIndex]);
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

  // Archiva una tarea con actualizacion optimista
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

  // Carga las tareas archivadas del tablero actual
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

  // Restaura una tarea archivada y refresca datos relacionados
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

  // Purga de forma permanente una tarea archivada
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

  updateTask: async (taskId, columnId, taskUpdatePayload) => {
    try {
      // Actualiza tarea en backend y fusiona respuesta con estado local
      const serverUpdatedTask = await updateTaskRequest(
        taskId,
        taskUpdatePayload,
      );

      set(function applyTaskUpdate(state) {
        if (!state.board) return state;

        const newBoard = { ...state.board };
        const column = findColumnById(newBoard.columns, columnId);

        if (column && column.tasks) {
          const taskIndex = findTaskIndex(column.tasks, taskId);
          if (taskIndex !== -1) {
            const previousTaskInColumn = column.tasks[taskIndex];
            const mergedTask: Task = {
              ...previousTaskInColumn,
              ...serverUpdatedTask,
            };
            mergedTask.links = mergePatchListField(
              previousTaskInColumn.links,
              taskUpdatePayload.links,
              serverUpdatedTask.links,
            ) as NonNullable<Task['links']>;
            mergedTask.checklist = mergePatchListField(
              previousTaskInColumn.checklist,
              taskUpdatePayload.checklist,
              serverUpdatedTask.checklist,
            ) as NonNullable<Task['checklist']>;
            column.tasks[taskIndex] = mergedTask;
            column.tasks = sortTasksInColumn(column.tasks);
          }
        }

        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al actualizar la tarea:", error);
      throw error;
    }
  },
}));
