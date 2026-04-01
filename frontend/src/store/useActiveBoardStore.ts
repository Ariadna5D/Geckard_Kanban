import { create } from 'zustand';
import { Board, UpdateTaskPositionPayload, Task } from '../types/board.types';
import { 
  addColumnRequest, 
  getBoardBySlugRequest, 
  updateColumnRequest, 
  deleteColumnRequest,
  updateColumnPositionRequest // <-- IMPORTAMOS LA NUEVA PETICIÓN
} from '../api/boards.api';
import { 
  updateTaskPosition, 
  createTaskRequest, 
  deleteTaskRequest, 
  updateTaskRequest
} from '../api/tasks.api';

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
  
  // CRUD Columnas
  addColumn: (boardId: string, title: string) => Promise<void>;
  editColumn: (boardId: string, columnId: string, title: string) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  moveColumnOptimistic: (boardId: string, columnId: string, newOrder: string) => Promise<void>;
  
  // CRUD Tareas
  addTask: (boardId: string, columnId: string, title: string, order: string) => Promise<void>;
  deleteTask: (taskId: string, columnId: string) => Promise<void>;
  updateTask: (taskId: string, columnId: string, data: Partial<Task>) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  isLoading: false,
  error: null,

  /**
   * Carga el tablero y ordena tanto las columnas como las tareas por su Fractional Index.
   */
  fetchBoard: async (slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await getBoardBySlugRequest(slug);
      
      // Ordenamos las columnas y las tareas de cada columna
      const sortedColumns = board.columns
        .sort((a, b) => (a.order || '').localeCompare(b.order || ''))
        .map(col => ({
          ...col,
          tasks: col.tasks?.sort((a, b) => (a.order || '').localeCompare(b.order || '')) || []
        }));

      set({ board: { ...board, columns: sortedColumns }, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar el tablero.', isLoading: false });
    }
  },

  /**
   * Mueve una tarea en 0ms en el frontend clonando el estado.
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
   * Reordena las columnas visualmente al instante y sincroniza con el servidor.
   */
  moveColumnOptimistic: async (boardId, columnId, newOrder) => {
    const previousBoard = get().board;
    if (!previousBoard) return;

    // 1. Clonamos el estado anterior para UI optimista
    const newBoard: Board = JSON.parse(JSON.stringify(previousBoard));
    const colIndex = newBoard.columns.findIndex(c => c._id === columnId);
    
    if (colIndex !== -1) {
      newBoard.columns[colIndex].order = newOrder;
      // Reordenamos las columnas basándonos en el nuevo index
      newBoard.columns.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
    }

    set({ board: newBoard });

    try {
      // 2. Mandamos el cambio al backend
      await updateColumnPositionRequest(boardId, columnId, newOrder);
    } catch (error) {
      console.error("Error al mover la columna, revirtiendo...", error);
      set({ board: previousBoard }); // 3. Rollback si falla
    }
  },

  /**
   * Añade una nueva columna al tablero manteniendo las tareas locales intactas.
   */
  addColumn: async (boardId: string, title: string) => {
    try {
      const updatedBoard = await addColumnRequest(boardId, title);
      
      set((state) => {
        if (!state.board) return state;

        const mergedColumns = updatedBoard.columns.map((backendCol) => {
          const existingFrontendCol = state.board!.columns.find(c => c._id === backendCol._id);
          return {
            ...backendCol,
            tasks: existingFrontendCol && existingFrontendCol.tasks ? existingFrontendCol.tasks : []
          };
        });

        // Aseguramos que la nueva columna también respete el orden
        mergedColumns.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
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
        const mergedColumns = updatedBoard.columns.map((backendCol) => {
          const existingFrontendCol = state.board!.columns.find(c => c._id === backendCol._id);
          return {
            ...backendCol,
            tasks: existingFrontendCol && existingFrontendCol.tasks ? existingFrontendCol.tasks : []
          };
        });
        mergedColumns.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
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
        const mergedColumns = updatedBoard.columns.map((backendCol) => {
          const existingFrontendCol = state.board!.columns.find(c => c._id === backendCol._id);
          return {
            ...backendCol,
            tasks: existingFrontendCol && existingFrontendCol.tasks ? existingFrontendCol.tasks : []
          };
        });
        mergedColumns.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
        return { board: { ...updatedBoard, columns: mergedColumns } };
      });
    } catch (error) {
      console.error("Error al borrar la columna:", error);
    }
  },

  /**
   * Crea una tarea esperando la respuesta del servidor para obtener su _id.
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
   * Actualiza el contenido de una tarea (título, descripción, etc.)
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
            column.tasks[taskIndex] = { ...column.tasks[taskIndex], ...updatedTask };
          }
        }
        
        return { board: newBoard };
      });
    } catch (error) {
      console.error("Error al actualizar la tarea:", error);
    }
  },
}));