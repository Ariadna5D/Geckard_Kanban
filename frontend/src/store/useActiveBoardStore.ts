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
import { compareOrderKey } from '../utils/boardMath';

function mergeServerColumnsWithLocalTasks(
  previousColumns: Column[],
  serverColumns: Column[],
): Column[] {
  const merged = serverColumns.map((serverCol) => {
    const local = previousColumns.find((col) => col._id === serverCol._id);
    return {
      ...serverCol,
      tasks: local?.tasks && local.tasks.length > 0 ? local.tasks : [],
    };
  });
  merged.sort((a, b) => compareOrderKey(a.order, b.order));
  return merged;
}

interface ActiveBoardState {
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
  addTask: (boardId: string, columnId: string, title: string, order: string) => Promise<void>;
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

      const sortedColumns = board.columns
        .sort((a, b) => compareOrderKey(a.order, b.order))
        .map((col) => ({
          ...col,
          tasks:
            col.tasks?.sort((a, b) => compareOrderKey(a.order, b.order)) || [],
        }));

      const boardPayload = { ...board, columns: sortedColumns };
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
    const sourceCol = newBoard.columns.find(c => c._id === oldColumnId);
    const destCol = newBoard.columns.find(c => c._id === newColumnId);

    if (!sourceCol || !destCol) return;

    const taskIndex = sourceCol.tasks!.findIndex(t => t._id === taskId);
    if (taskIndex === -1) return;
    
    const [taskToMove] = sourceCol.tasks!.splice(taskIndex, 1);

    taskToMove.columnId = newColumnId;
    taskToMove.order = newOrder;
    destCol.tasks!.push(taskToMove);
    destCol.tasks!.sort((a, b) => compareOrderKey(a.order, b.order));

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
    const colIndex = newBoard.columns.findIndex(c => c._id === columnId);
    
    if (colIndex !== -1) {
      newBoard.columns[colIndex].order = newOrder;
      // Reorden visual por order.
      newBoard.columns.sort((a, b) => compareOrderKey(a.order, b.order));
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
      
      set((state) => {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return { board: { ...updatedBoard, columns: mergedColumns } };
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
      
      set((state) => {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return { board: { ...updatedBoard, columns: mergedColumns } };
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
      
      set((state) => {
        if (!state.board) return state;
        const mergedColumns = mergeServerColumnsWithLocalTasks(
          state.board.columns,
          updatedBoard.columns,
        );
        return { board: { ...updatedBoard, columns: mergedColumns } };
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
      const newTask = await createTaskRequest({ boardId, columnId, title, order });
      
      set((state) => {
        if (!state.board) return state;
        
        const newBoard = { ...state.board };
        const column = newBoard.columns.find(c => c._id === columnId);
        
        if (column) {
          column.tasks = [...(column.tasks || []), newTask];
          column.tasks.sort((a, b) => compareOrderKey(a.order, b.order));
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
    const column = newBoard.columns.find(c => c._id === columnId);
    
    if (column && column.tasks) {
      column.tasks = column.tasks.filter(t => t._id !== taskId);
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
      
      set((state) => {
        if (!state.board) return state;
        
        const newBoard = { ...state.board };
        const column = newBoard.columns.find(c => c._id === columnId);
        
        if (column && column.tasks) {
          const taskIndex = column.tasks.findIndex(t => t._id === taskId);
          if (taskIndex !== -1) {
            const prev = column.tasks[taskIndex];
            const next: Task = { ...prev, ...updatedTask };
            if (!Array.isArray(next.links)) {
              next.links = prev.links ?? [];
            }
            if (!Array.isArray(next.checklist)) {
              next.checklist = prev.checklist ?? [];
            }
            column.tasks[taskIndex] = next;
          }
        }
        
        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al actualizar la tarea:", error);
    }
  },
}));