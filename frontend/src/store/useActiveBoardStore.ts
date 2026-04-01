import { create } from 'zustand';
import { Board, UpdateTaskPositionPayload } from '../types/board.types';
import { addColumnRequest, getBoardBySlugRequest } from '../api/boards.api';
import { updateTaskPosition, createTaskRequest, deleteTaskRequest } from '../api/tasks.api';

interface ActiveBoardState {
  board: Board | null;
  isLoading: boolean;
  error: string | null;

  fetchBoard: (slug: string) => Promise<void>;
  moveTaskOptimistic: (
    taskId: string,
    oldColumnId: string,
    newColumnId: string,
    newOrder: string,
    apiPayload: UpdateTaskPositionPayload
  ) => Promise<void>;
  addColumn: (boardId: string, title: string) => Promise<void>;
  
  addTask: (boardId: string, columnId: string, title: string, order: string) => Promise<void>;
  deleteTask: (taskId: string, columnId: string) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  isLoading: false,
  error: null,

  /**
   * Carga el tablero y ordena las tareas alfabéticamente por su Fractional Index.
   */
  fetchBoard: async (slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await getBoardBySlugRequest(slug);
      
      const sortedColumns = board.columns.map(col => ({
        ...col,
        tasks: col.tasks?.sort((a, b) => a.order.localeCompare(b.order)) || []
      }));

      set({ board: { ...board, columns: sortedColumns }, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar el tablero.', isLoading: false });
    }
  },

  /**
   * Mueve una tarea en 0ms en el frontend clonando el estado, y luego hace la petición.
   * Si el servidor falla, restaura el estado anterior (Rollback).
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
    destCol.tasks!.sort((a, b) => a.order.localeCompare(b.order));

    set({ board: newBoard });

    try {
      await updateTaskPosition(taskId, apiPayload);
    } catch (error) {
      console.error("Error al mover la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },

  /**
   * Añade una nueva columna al tablero.
   */
  addColumn: async (boardId: string, title: string) => {
    try {
      // 1. El backend devuelve el tablero con la nueva columna, pero sin tareas pobladas
      const updatedBoard = await addColumnRequest(boardId, title);
      
      set((state) => {
        if (!state.board) return state;

        // 2. Fusionamos: Mantenemos las columnas del backend, pero rescatamos las tareas del frontend
        const mergedColumns = updatedBoard.columns.map((backendCol) => {
          // Buscamos si esta columna ya existía en nuestro frontend
          const existingFrontendCol = state.board!.columns.find(c => c._id === backendCol._id);
          
          return {
            ...backendCol,
            // Si existía, le devolvemos sus tareas. Si es la nueva, le ponemos un array vacío.
            tasks: existingFrontendCol && existingFrontendCol.tasks ? existingFrontendCol.tasks : []
          };
        });

        // 3. Actualizamos el estado de forma segura
        return {
          board: {
            ...updatedBoard,
            columns: mergedColumns
          }
        };
      });
    } catch (error) {
      console.error("Error al crear la columna:", error);
    }
  },

  /**
   * Crea una tarea. Esperamos al backend para tener el _id real (obligatorio para dnd-kit)
   * antes de inyectarla en el estado. No usamos UI optimista aquí.
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
          column.tasks.sort((a, b) => a.order.localeCompare(b.order));
        }
        
        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al crear la tarea:", error);
    }
  },

  /**
   * Borra una tarea usando UI Optimista. La quita de la pantalla al instante
   * y hace el borrado por debajo. Si falla, la vuelve a mostrar.
   */
  deleteTask: async (taskId, columnId) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

    const newBoard = JSON.parse(JSON.stringify(previousBoard));
    const column = newBoard.columns.find((c: any) => c._id === columnId);
    
    if (column && column.tasks) {
      column.tasks = column.tasks.filter((t: any) => t._id !== taskId);
    }

    set({ board: newBoard });

    try {
      await deleteTaskRequest(taskId);
    } catch (error) {
      console.error("Error al borrar la tarea, revirtiendo...", error);
      set({ board: previousBoard });
    }
  },
}));